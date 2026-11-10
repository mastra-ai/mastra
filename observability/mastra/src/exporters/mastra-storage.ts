import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  TracingEvent,
  InitExporterOptions,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityDropEvent,
  ObservabilityDropReason,
  ObservabilityDropSignal,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import type { ObservabilityStorage, TracingStorageStrategy, MastraCompositeStore } from '@mastra/core/storage';
import {
  buildCreateSpanRecord,
  buildUpdateSpanRecord,
  buildMetricRecord,
  buildLogRecord,
  buildScoreRecord,
  buildFeedbackRecord,
} from '@mastra/core/storage';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';
import { EventBuffer } from './event-buffer';
import type { BufferedEvent, RetryCount, UpdateSpanPartial } from './event-buffer';
import { withSpanPreviews } from './span-previews';
import { StorageByteTracker, resolveStorageByteBatching } from './storage-byte-tracker';
import type { StorageByteBatchingConfig, StorageByteBatchingStats } from './storage-byte-tracker';
import { skipLocalStorageOnPlatform } from './storage-platform-policy';
export type { StorageByteBatchingConfig, StorageByteBatchingStats } from './storage-byte-tracker';

/** Configuration for the MastraStorageExporter's batching, retry, and strategy behavior. */
export interface MastraStorageExporterConfig extends BaseExporterConfig {
  byteBatching?: StorageByteBatchingConfig;
  maxBatchSize?: number; // Default: 1000 spans
  maxBufferSize?: number; // Default: 10000 spans
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number; // Default: 4
  retryDelayMs?: number; // Default: 500ms (base delay for exponential backoff)

  // Strategy selection (optional)
  strategy?: TracingStorageStrategy | 'auto';
}

/**
 * Resolves the final tracing storage strategy based on config and observability store hints
 */
function resolveTracingStorageStrategy(
  config: MastraStorageExporterConfig,
  observabilityStorage: ObservabilityStorage,
  storageName: string,
  logger: IMastraLogger,
): TracingStorageStrategy {
  const observabilityStrategy = observabilityStorage.observabilityStrategy;
  if (config.strategy && config.strategy !== 'auto') {
    if (observabilityStrategy.supported.includes(config.strategy)) {
      return config.strategy;
    }
    // Log warning and fall through to auto-selection
    logger.warn('User-specified tracing strategy not supported by storage adapter, falling back to auto-selection', {
      userStrategy: config.strategy,
      storageAdapter: storageName,
      supportedStrategies: observabilityStrategy.supported,
      fallbackStrategy: observabilityStrategy.preferred,
    });
  }
  return observabilityStrategy.preferred;
}

type FlushResult = {
  failed: boolean;
  retryAttempt?: number;
};

const FLUSH_SUCCEEDED: FlushResult = { failed: false };
/** Max join/write rounds a single flush() makes before it returns under continuous traffic */
const MAX_FLUSH_ROUNDS = 3;

/**
 * Storage-backed exporter. Buffers observability events and flushes them in
 * batches to the configured ObservabilityStorage backend with retry support.
 */
export class MastraStorageExporter extends BaseExporter {
  name = 'mastra-storage-exporter';

  #config: MastraStorageExporterConfig;
  #initializationPromise?: Promise<void>;
  #wasUnavailable = false;
  #eventBuffer: EventBuffer;
  #byteTracker?: StorageByteTracker;
  // Back off the shared storage connection across signals after a failed write.
  #byteRetryAt = 0;
  #byteDrainers = 0;

  #storage?: MastraCompositeStore;
  #observabilityStorage?: ObservabilityStorage;
  #resolvedStrategy?: TracingStorageStrategy;
  #flushTimer?: NodeJS.Timeout;
  /** Storage writes (timer, size trigger, or flush()) that haven't finished yet */
  #inFlightFlushes = new Set<Promise<void>>();
  #emitDropEvent?: (event: ObservabilityDropEvent) => void;

  // Signals whose storage methods threw "not implemented" — skip on future flushes
  #unsupportedSignals: Set<ObservabilityDropSignal> = new Set();

  constructor(config: MastraStorageExporterConfig = {}) {
    super(config);

    // Set default configuration
    this.#config = {
      ...config,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBufferSize: config.maxBufferSize ?? 10000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: config.maxRetries ?? 4,
      retryDelayMs: config.retryDelayMs ?? 500,
      strategy: config.strategy ?? 'auto',
    };

    if (config.byteBatching) {
      if (!Number.isSafeInteger(this.#config.maxBatchSize) || this.#config.maxBatchSize! <= 0) {
        throw new Error('maxBatchSize must be a positive safe integer in byte mode');
      }
      this.#byteTracker = new StorageByteTracker(resolveStorageByteBatching(config.byteBatching));
    }
    this.#eventBuffer = new EventBuffer({ maxRetries: this.#config.maxRetries ?? 4, byteTracker: this.#byteTracker });
  }

  /**
   * Initialize the exporter (called after all dependencies are ready)
   */
  async init(options: InitExporterOptions): Promise<void> {
    this.#emitDropEvent = options.emitDropEvent;
    this.#storage = options.mastra?.getStorage();
    if (!this.#storage) {
      this.logger.warn('MastraStorageExporter disabled: Storage not available. Traces will not be persisted.');
      return;
    }
    await this.ensureInitialized();
  }

  private warnUnavailable(message: string, error?: unknown): void {
    if (this.#wasUnavailable) return;
    this.#wasUnavailable = true;
    if (error === undefined) {
      this.logger.warn(message);
      return;
    }
    this.logger.warn(message, { error: error instanceof Error ? error.message : String(error) });
  }

  private async initializeStorage(): Promise<void> {
    const storage = this.#storage;
    if (!storage) return;

    try {
      this.#observabilityStorage = await storage.getStore('observability');
    } catch (error) {
      this.warnUnavailable(
        'MastraStorageExporter unavailable: Failed to initialize observability storage. Traces will not be persisted until storage becomes available.',
        error,
      );
      return;
    }

    if (!this.#observabilityStorage) {
      this.warnUnavailable(
        'MastraStorageExporter unavailable: Observability storage not available. Traces will not be persisted until storage becomes available.',
      );
      return;
    }

    if (skipLocalStorageOnPlatform(this.#observabilityStorage, this.logger)) {
      this.#observabilityStorage = undefined;
      // Do not retry initialization or warn again on each exported event.
      this.#storage = undefined;
      return;
    }

    this.#resolvedStrategy = resolveTracingStorageStrategy(
      this.#config,
      this.#observabilityStorage,
      storage.constructor.name,
      this.logger,
    );

    if (this.#resolvedStrategy === 'realtime' && this.#byteTracker) {
      this.logger.warn('MastraStorageExporter: byteBatching is ignored for the realtime strategy.');
      // Strategy is resolved before any event is accepted. Keep realtime's
      // existing immediate, awaited writes even when byte batching is configured.
      this.#byteTracker = undefined;
      this.#eventBuffer = new EventBuffer({ maxRetries: this.#config.maxRetries! });
    }
    this.#eventBuffer.init({ strategy: this.#resolvedStrategy });
    this.logger.debug('tracing storage exporter initialized', {
      strategy: this.#resolvedStrategy,
      source: this.#config.strategy !== 'auto' ? 'user' : 'auto',
      storageAdapter: storage.constructor.name,
      maxBatchSize: this.#config.maxBatchSize,
      maxBatchWaitMs: this.#config.maxBatchWaitMs,
    });

    if (this.#wasUnavailable) {
      this.#wasUnavailable = false;
      this.logger.info(
        'MastraStorageExporter recovered: Observability storage is available. Traces will be persisted.',
      );
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.#observabilityStorage || !this.#storage) return;

    this.#initializationPromise ??= this.initializeStorage().finally(() => {
      this.#initializationPromise = undefined;
    });
    await this.#initializationPromise;
  }

  /**
   * Checks if buffer should be flushed based on size or time triggers
   */
  private shouldFlush(): boolean {
    if (this.#byteTracker && this.#byteTracker.queuedBytes >= this.#byteTracker.config.maxBatchBytes) return true;
    if (this.#resolvedStrategy === 'realtime') {
      return true;
    }

    // Emergency flush - buffer overflow
    if (this.#eventBuffer.totalSize >= this.#config.maxBufferSize!) {
      return true;
    }

    // Size-based flush
    if (this.#eventBuffer.totalSize >= this.#config.maxBatchSize!) {
      return true;
    }

    // Time-based flush
    if (this.#eventBuffer.totalSize > 0) {
      if (this.#eventBuffer.elapsed >= this.#config.maxBatchWaitMs!) {
        return true;
      }
    }

    return false;
  }

  /**
   * Schedules a flush using setTimeout
   */
  private scheduleFlush(delayMs = this.#config.maxBatchWaitMs!): void {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
    }
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = undefined;
      this.trackFlushBuffer().catch(error => {
        this.logger.error('Scheduled flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs);
  }

  private retryDelay(retryAttempt: number): number {
    return this.#config.retryDelayMs! * 2 ** (retryAttempt - 1);
  }

  private retryAttempt(events: BufferedEvent[]): number | undefined {
    return events.reduce<number | undefined>((earliestAttempt, event) => {
      if (event.retryCount > this.#config.maxRetries!) return earliestAttempt;
      return earliestAttempt === undefined ? event.retryCount : Math.min(earliestAttempt, event.retryCount);
    }, undefined);
  }

  private logStorageFailure(
    signal: ObservabilityDropSignal,
    events: BufferedEvent[],
    retryAttempt: number | undefined,
    error: unknown,
  ): void {
    this.logger.warn('Failed to persist observability events', {
      signal,
      eventCount: events.length,
      retryAttempt:
        retryAttempt ?? events.reduce((latestAttempt, event) => Math.max(latestAttempt, event.retryCount), 0),
      maxRetries: this.#config.maxRetries,
      ...(retryAttempt === undefined ? {} : { nextRetryDelayMs: this.retryDelay(retryAttempt) }),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Checks flush triggers and schedules/triggers flush as needed.
   * Called after adding any event to the buffer.
   * Returns the flush promise when flushing so callers can await it.
   */
  private async handleBatchedFlush(): Promise<void> {
    if (this.shouldFlush()) {
      const writing = this.trackFlushBuffer();
      if (this.#byteTracker) {
        void writing.catch(error => this.logger.error('Byte batch flush failed', { error }));
      } else {
        await writing;
      }
    } else if (this.#eventBuffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }

  private sanitizeDropError(error: unknown): ObservabilityDropEvent['error'] {
    if (error instanceof MastraError) {
      return {
        id: error.id,
        domain: String(error.domain),
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }

    return { message: String(error) };
  }

  private emitDrop(
    signal: ObservabilityDropSignal,
    reason: ObservabilityDropReason,
    count: number,
    error?: unknown,
  ): void {
    if (count === 0) return;

    const dropEvent: ObservabilityDropEvent = {
      type: 'drop',
      signal,
      reason,
      count,
      timestamp: new Date(),
      exporterName: this.name,
      ...(this.#observabilityStorage ? { storageName: this.#observabilityStorage.constructor.name } : {}),
      ...(error === undefined ? {} : { error: this.sanitizeDropError(error) }),
    };

    this.#emitDropEvent?.(dropEvent);
  }

  /**
   * Flush a batch of create events for a single signal type.
   * On "not implemented" errors, disables the signal for future flushes.
   * On other errors, re-adds events to the buffer for retry.
   */
  private async flushCreates<T extends BufferedEvent>(
    signal: ObservabilityDropSignal,
    events: T[],
    storageCall: (events: T[]) => Promise<void>,
  ): Promise<FlushResult> {
    if (events.length === 0) return FLUSH_SUCCEEDED;
    if (this.#unsupportedSignals.has(signal)) {
      this.emitDrop(signal, 'unsupported-storage', events.length);
      return { failed: true };
    }

    try {
      await storageCall(events);
      return FLUSH_SUCCEEDED;
    } catch (error) {
      if (
        error instanceof MastraError &&
        error.domain === ErrorDomain.MASTRA_OBSERVABILITY &&
        error.id.endsWith('_NOT_IMPLEMENTED')
      ) {
        this.logger.warn(error.message);
        this.#unsupportedSignals.add(signal);
        this.emitDrop(signal, 'unsupported-storage', events.length, error);
        return { failed: true };
      }

      const dropped = this.#eventBuffer.reAddCreates(events);
      this.#eventBuffer.forgetDroppedCreates(dropped);
      const retryAttempt = this.retryAttempt(events);
      this.logStorageFailure(signal, events, retryAttempt, error);
      this.emitDrop(signal, 'retry-exhausted', dropped.length, error);
      return { failed: true, retryAttempt };
    }
  }

  /**
   * Flush span update/end events.
   *
   * When the store supports conditional updates, only spans this exporter started
   * and hasn't confirmed the create for are deferred. Everything else, including
   * spans another exporter instance started (such as a durable agent ending spans
   * it rebuilt after a crash), goes straight to storage, and updates that didn't
   * apply are counted as drops. Without conditional updates, updates for spans this
   * exporter hasn't created are deferred until their create is flushed.
   *
   * When `isEnd` is true, successfully flushed spans are removed from tracking.
   */
  private async flushSpanUpdates(
    events: (TracingEvent & RetryCount)[],
    deferredUpdates: BufferedEvent[],
    isEnd: boolean,
  ): Promise<FlushResult> {
    const deferredCountAtEntry = deferredUpdates.length;
    if (events.length === 0) return FLUSH_SUCCEEDED;
    if (this.#unsupportedSignals.has('tracing')) {
      this.emitDrop('tracing', 'unsupported-storage', events.length);
      return { failed: true };
    }

    const storage = this.#observabilityStorage!;
    // Detected at runtime so older stores and older core versions keep the previous behavior
    const batchUpdateUnendedSpans =
      typeof storage.batchUpdateUnendedSpans === 'function' ? storage.batchUpdateUnendedSpans.bind(storage) : undefined;

    const partials: UpdateSpanPartial[] = [];
    for (const event of events) {
      const span = event.exportedSpan;
      const canSend = batchUpdateUnendedSpans
        ? !this.#eventBuffer.isAwaitingCreate(span)
        : this.#eventBuffer.spanExists(span);
      if (canSend) {
        partials.push({
          traceId: span.traceId,
          spanId: span.id,
          updates: buildUpdateSpanRecord(span),
        });
      } else {
        deferredUpdates.push(event);
      }
    }

    if (partials.length === 0) return FLUSH_SUCCEEDED;

    try {
      if (batchUpdateUnendedSpans) {
        const { updated } = await batchUpdateUnendedSpans({ records: partials });
        this.emitNotApplied(partials, updated);
      } else {
        await storage.batchUpdateSpans({ records: partials });
      }
      if (isEnd) {
        this.#eventBuffer.endFinishedSpans({ records: partials });
      }
      return FLUSH_SUCCEEDED;
    } catch (error) {
      if (
        error instanceof MastraError &&
        error.domain === ErrorDomain.MASTRA_OBSERVABILITY &&
        error.id.endsWith('_NOT_IMPLEMENTED')
      ) {
        this.logger.warn(error.message);
        this.#unsupportedSignals.add('tracing');
        deferredUpdates.length = 0;
        this.emitDrop('tracing', 'unsupported-storage', events.length + deferredCountAtEntry, error);
        return { failed: true };
      }

      // `events` includes both partials-bound and newly-deferred entries, so
      // re-adding it would double-add the newly-deferred ones if they stayed
      // in deferredUpdates. Splice off only what this call appended — entries
      // from a prior flushSpanUpdates call must survive.
      const newlyDeferred = deferredUpdates.length - deferredCountAtEntry;
      if (newlyDeferred > 0) {
        deferredUpdates.splice(deferredUpdates.length - newlyDeferred, newlyDeferred);
      }
      const dropped = this.#eventBuffer.reAddUpdates(events);
      const retryAttempt = this.retryAttempt(events);
      this.logStorageFailure('tracing', events, retryAttempt, error);
      this.emitDrop('tracing', 'retry-exhausted', dropped.length, error);
      return { failed: true, retryAttempt };
    }
  }

  /**
   * Reports conditional span updates that storage didn't apply: the span wasn't
   * stored, or it had already ended. Ended spans are immutable, so these are dropped.
   */
  private emitNotApplied(partials: UpdateSpanPartial[], updated: { traceId: string; spanId: string }[]): void {
    // Count per key: one batch can hold two ends for the same span, and only the first applies.
    const appliedCounts = new Map<string, number>();
    for (const span of updated) {
      const key = `${span.traceId}:${span.spanId}`;
      appliedCounts.set(key, (appliedCounts.get(key) ?? 0) + 1);
    }
    let notApplied = 0;
    for (const partial of partials) {
      const key = `${partial.traceId}:${partial.spanId}`;
      const remaining = appliedCounts.get(key) ?? 0;
      if (remaining > 0) {
        appliedCounts.set(key, remaining - 1);
      } else {
        notApplied++;
      }
    }
    if (notApplied === 0) return;

    this.logger.debug('Span updates not applied: span not stored or already ended', { count: notApplied });
    this.emitDrop('tracing', 'span-not-updatable', notApplied);
  }

  /**
   * Runs flushBuffer() and tracks its promise so flush() can wait for writes
   * that a timer or size trigger started on their own.
   */
  private trackFlushBuffer(): Promise<void> {
    if (this.#byteTracker) {
      const concurrency =
        this.#resolvedStrategy === 'insert-only' || this.#resolvedStrategy === 'event-sourced'
          ? this.#byteTracker.config.maxConcurrentWrites
          : 1;
      if (this.#inFlightFlushes.size >= concurrency) return Promise.resolve();
      const delay = this.#byteRetryAt - Date.now();
      if (delay > 0) {
        this.scheduleFlush(delay);
        return Promise.resolve();
      }
    }
    let reschedule = true;
    const promise = this.flushBuffer()
      .catch(error => {
        // Storage retry failures are handled inside flushBuffer. An unexpected
        // failure must not schedule an immediate loop over the same stalled data.
        reschedule = false;
        throw error;
      })
      .finally(() => {
        this.#inFlightFlushes.delete(promise);
        if (reschedule && this.#byteTracker && this.#eventBuffer.totalSize > 0) {
          const delay = Math.max(0, this.#byteRetryAt - Date.now());
          this.scheduleFlush(delay || (this.#byteDrainers || this.shouldFlush() ? 0 : this.#config.maxBatchWaitMs!));
        }
      });
    this.#inFlightFlushes.add(promise);
    return promise;
  }

  /**
   * Flushes the current buffer to storage.
   *
   * Creates are flushed first, then their span keys are added to allCreatedSpans.
   * Updates are checked against allCreatedSpans — those whose span hasn't been
   * created yet are re-inserted into the live buffer for the next flush.
   * Completed spans (SPAN_ENDED) are cleaned up from allCreatedSpans after success.
   */
  private async flushBuffer(): Promise<void> {
    if (!this.#observabilityStorage) {
      this.logger.debug('Cannot flush. Observability storage is not initialized');
      return;
    }
    if (!this.#resolvedStrategy) {
      this.logger.debug('Cannot flush. Observability strategy is not resolved');
      return;
    }

    // Clear timer since we're flushing
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }

    if (this.#eventBuffer.totalSize === 0) {
      return;
    }

    const startTime = Date.now();
    const batchSize = this.#eventBuffer.totalSize;

    // Snapshot and reset buffer so new events can accumulate during flush
    const { creates, updates } = this.#byteTracker
      ? this.#eventBuffer.takeByteBatch(this.#config.maxBatchSize!)
      : { creates: this.#eventBuffer.creates, updates: this.#eventBuffer.updates };
    if (this.#byteTracker && creates.length === 0 && updates.length === 0 && this.#inFlightFlushes.size === 0) {
      const message = 'MastraStorageExporter flush made no progress: queued events have no eligible batch.';
      this.logger.error(message, { bufferedEvents: this.#eventBuffer.totalSize });
      throw new Error(message);
    }
    if (!this.#byteTracker) this.#eventBuffer.reset();
    try {
      const createFeedbackEvents: (FeedbackEvent & RetryCount)[] = [];
      const createLogEvents: (LogEvent & RetryCount)[] = [];
      const createMetricEvents: (MetricEvent & RetryCount)[] = [];
      const createScoreEvents: (ScoreEvent & RetryCount)[] = [];
      const createSpanEvents: (TracingEvent & RetryCount)[] = [];

      const updateSpanEvents: (TracingEvent & RetryCount)[] = [];
      const endSpanEvents: (TracingEvent & RetryCount)[] = [];

      for (const createEvent of creates) {
        switch (createEvent.type) {
          case 'feedback':
            createFeedbackEvents.push(createEvent);
            break;
          case 'log':
            createLogEvents.push(createEvent);
            break;
          case 'metric':
            createMetricEvents.push(createEvent);
            break;
          case 'score':
            createScoreEvents.push(createEvent);
            break;
          default:
            createSpanEvents.push(createEvent);
            break;
        }
      }

      for (const updateEvent of updates) {
        switch (updateEvent.type) {
          case TracingEventType.SPAN_UPDATED:
            updateSpanEvents.push(updateEvent);
            break;
          case TracingEventType.SPAN_ENDED:
            endSpanEvents.push(updateEvent);
            break;
        }
      }

      // Flush all creates in parallel — signals are independent
      const createTasks = [
        () =>
          this.flushCreates('feedback', createFeedbackEvents, events =>
            this.#observabilityStorage!.batchCreateFeedback({ feedbacks: events.map(f => buildFeedbackRecord(f)) }),
          ),
        () =>
          this.flushCreates('log', createLogEvents, events =>
            this.#observabilityStorage!.batchCreateLogs({ logs: events.map(l => buildLogRecord(l)) }),
          ),
        () =>
          this.flushCreates('metric', createMetricEvents, events =>
            this.#observabilityStorage!.batchCreateMetrics({ metrics: events.map(m => buildMetricRecord(m)) }),
          ),
        () =>
          this.flushCreates('score', createScoreEvents, events =>
            this.#observabilityStorage!.batchCreateScores({ scores: events.map(s => buildScoreRecord(s)) }),
          ),
        () =>
          this.flushCreates('tracing', createSpanEvents, async events => {
            const records = events.map(t => buildCreateSpanRecord(t.exportedSpan));
            await this.#observabilityStorage!.batchCreateSpans({ records });
            this.#eventBuffer.addCreatedSpans({ records });
          }),
      ];
      const flushResults: FlushResult[] = [];
      if (this.#byteTracker) {
        for (const task of createTasks) flushResults.push(await task());
      } else {
        flushResults.push(...(await Promise.all(createTasks.map(task => task()))));
      }

      // Flush span updates and ends — check span existence, defer if not yet created
      const deferredUpdates: BufferedEvent[] = [];

      flushResults.push(await this.flushSpanUpdates(updateSpanEvents, deferredUpdates, false));
      flushResults.push(await this.flushSpanUpdates(endSpanEvents, deferredUpdates, true));

      let deferredDropCount = 0;
      if (deferredUpdates.length > 0) {
        if (this.#unsupportedSignals.has('tracing')) {
          deferredDropCount = deferredUpdates.length;
          this.emitDrop('tracing', 'unsupported-storage', deferredDropCount);
          deferredUpdates.length = 0;
        } else {
          const dropped = this.#eventBuffer.reAddUpdates(deferredUpdates);
          deferredDropCount = dropped.length;
          this.emitDrop('tracing', 'retry-exhausted', deferredDropCount);
        }
      }

      const retryAttempt = flushResults.reduce<number | undefined>((earliestAttempt, result) => {
        if (result.retryAttempt === undefined) return earliestAttempt;
        return earliestAttempt === undefined ? result.retryAttempt : Math.min(earliestAttempt, result.retryAttempt);
      }, undefined);
      if (retryAttempt !== undefined) {
        if (this.#byteTracker) this.#byteRetryAt = Date.now() + this.retryDelay(retryAttempt);
        this.scheduleFlush(this.retryDelay(retryAttempt));
      }

      if (!flushResults.some(result => result.failed) && deferredDropCount === 0) {
        const elapsed = Date.now() - startTime;
        this.logger.debug('Batch flushed', {
          strategy: this.#resolvedStrategy,
          batchSize,
          durationMs: elapsed,
          deferredUpdates: deferredUpdates.length > 0 ? deferredUpdates.length : undefined,
        });
      }
    } finally {
      this.#eventBuffer.releaseByteBatch([...creates, ...updates]);
    }
  }

  getByteBatchingStats(): StorageByteBatchingStats | undefined {
    return this.#byteTracker?.stats(this.#inFlightFlushes.size);
  }

  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this.#observabilityStorage) {
      this.logger.debug('Cannot store traces. Observability storage is not initialized');
      return;
    }

    this.#eventBuffer.addEvent({ ...event, exportedSpan: withSpanPreviews(event.exportedSpan) });
    await this.handleBatchedFlush();
  }

  /**
   * Handle metric events — buffer for batch flush.
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle log events — buffer for batch flush.
   */
  async onLogEvent(event: LogEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle score events — buffer for batch flush.
   */
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle feedback events — buffer for batch flush.
   */
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    if (this.#byteTracker) {
      if (!this.#observabilityStorage) return;
      this.#byteDrainers++;
      try {
        while (this.#eventBuffer.totalSize || this.#inFlightFlushes.size) {
          if (this.#inFlightFlushes.size) await Promise.allSettled([...this.#inFlightFlushes]);
          const delay = this.#byteRetryAt - Date.now();
          if (delay > 0 && this.#eventBuffer.totalSize) await new Promise(resolve => setTimeout(resolve, delay));
          if (this.#eventBuffer.totalSize) await this.trackFlushBuffer();
        }
      } finally {
        this.#byteDrainers--;
      }
      return;
    }
    // A timer or size trigger may have taken a batch out of the buffer and still be
    // writing it, so an empty buffer doesn't mean the data reached storage. Each round
    // joins those writes first (they can defer span updates back into the buffer), then
    // writes whatever the buffer holds. Writes that start while we work get a few more
    // rounds, then we stop taking on new work so flush() stays bounded under non-stop
    // traffic (same cap as ObservabilityBus), but we still join the writes already running
    // so nothing is mid-write when we return. A batch that failed is left to its retry
    // timer, as before.
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round++) {
      if (this.#inFlightFlushes.size > 0) {
        await Promise.allSettled([...this.#inFlightFlushes]);
      }
      if (this.#eventBuffer.totalSize > 0) {
        this.logger.debug('Flushing buffered events', {
          bufferedEvents: this.#eventBuffer.totalSize,
        });
        await this.trackFlushBuffer();
      }
      if (this.#inFlightFlushes.size === 0) {
        return;
      }
    }
    await Promise.allSettled([...this.#inFlightFlushes]);
    this.logger.warn(`flush() stopped after ${MAX_FLUSH_ROUNDS} rounds; new writes kept starting`, {
      bufferedEventsLeftBehind: this.#eventBuffer.totalSize,
    });
  }

  async shutdown(): Promise<void> {
    // Clear any pending timer
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }

    try {
      await this.flush();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_EXPORTER_FAILED_TO_FLUSH_REMAINING_EVENTS_DURING_SHUTDOWN',
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.SYSTEM,
          details: { remainingEvents: this.#eventBuffer.totalSize },
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Failed to flush remaining events during shutdown', mastraError);
    } finally {
      if (this.#flushTimer) {
        clearTimeout(this.#flushTimer);
        this.#flushTimer = undefined;
      }
    }

    this.logger.info('MastraStorageExporter shutdown complete');
  }
}
