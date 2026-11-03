import { MastraError, ErrorDomain } from '@mastra/core/error';
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

/** Configuration for the MastraStorageExporter's batching, retry, and strategy behavior. */
export interface MastraStorageExporterConfig extends BaseExporterConfig {
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

function dropSignal(event: BufferedEvent): ObservabilityDropSignal {
  switch (event.type) {
    case 'feedback':
    case 'log':
    case 'metric':
    case 'score':
      return event.type;
    default:
      return 'tracing';
  }
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

  #storage?: MastraCompositeStore;
  #observabilityStorage?: ObservabilityStorage;
  #resolvedStrategy?: TracingStorageStrategy;
  #flushTimer?: NodeJS.Timeout;
  #flushAt = 0;
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

    this.#eventBuffer = new EventBuffer({ maxRetries: this.#config.maxRetries ?? 4 });
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

    this.#resolvedStrategy = resolveTracingStorageStrategy(
      this.#config,
      this.#observabilityStorage,
      storage.constructor.name,
      this.logger,
    );

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
   * Schedules a flush, keeping one already scheduled to fire sooner. The timer holds the
   * process open only while a batch is owed; one that only waits out a retry delay lets a
   * finished worker exit.
   */
  private scheduleFlush(delayMs = this.#config.maxBatchWaitMs!): void {
    const flushAt = Date.now() + delayMs;
    let timer = this.#flushTimer;
    if (timer === undefined || flushAt < this.#flushAt) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.#flushTimer = undefined;
        this.trackFlushBuffer().catch(error => {
          this.logger.error('Scheduled flush failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, delayMs);
      this.#flushTimer = timer;
      this.#flushAt = flushAt;
    }
    if (this.#eventBuffer.hasDueEvents) {
      timer.ref?.();
    } else {
      timer.unref?.();
    }
  }

  /** Every flush clears the timer, so re-arm it for updates still waiting out their retry delay. */
  private scheduleWaitingRetries(): void {
    const nextRetryAt = this.#eventBuffer.nextRetryAt;
    if (nextRetryAt !== undefined) {
      this.scheduleFlush(Math.max(0, nextRetryAt - Date.now()));
    }
  }

  private retryDelay = (retryAttempt: number): number => this.#config.retryDelayMs! * 2 ** (retryAttempt - 1);

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
      await this.trackFlushBuffer();
    } else {
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
   * spans another exporter instance started (a durable agent ending spans it rebuilt
   * after a crash, or a worker finishing a run the API process started), goes straight
   * to storage. Updates that didn't apply are retried or dropped by `retryNotApplied`.
   * Without conditional updates, updates for spans this exporter hasn't created are
   * deferred until their create is flushed.
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
    const sent: (TracingEvent & RetryCount)[] = [];
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
        sent.push(event);
      } else {
        deferredUpdates.push(event);
      }
    }

    if (partials.length === 0) return FLUSH_SUCCEEDED;

    try {
      let retrying = false;
      if (batchUpdateUnendedSpans) {
        const { updated } = await batchUpdateUnendedSpans({ records: partials });
        retrying = this.retryNotApplied(sent, updated);
      } else {
        await storage.batchUpdateSpans({ records: partials });
      }
      if (isEnd) {
        this.#eventBuffer.endFinishedSpans({ records: partials });
      }
      return retrying ? { failed: true } : FLUSH_SUCCEEDED;
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
      const dropped = this.#eventBuffer.reAddUpdates(events, this.retryDelay);
      const retryAttempt = this.retryAttempt(events);
      this.logStorageFailure('tracing', events, retryAttempt, error);
      this.emitDrop('tracing', 'retry-exhausted', dropped.length, error);
      return { failed: true, retryAttempt };
    }
  }

  /**
   * Handles conditional span updates that storage didn't apply. The store can't say
   * whether the row is missing or already ended. A span this exporter created and
   * hasn't ended must have a row, so its update is dropped as already ended. Any other
   * span may belong to a process whose create hasn't landed yet, so its update goes
   * back on the retry budget, waits out its backoff, and is dropped only when the
   * budget runs out. That drop is routine for a single process too (a durable run ends
   * its suspended step twice today), so it stays at debug level.
   *
   * Returns whether any update was re-queued.
   */
  private retryNotApplied(
    events: (TracingEvent & RetryCount)[],
    updated: { traceId: string; spanId: string }[],
  ): boolean {
    // Count per key: one batch can hold two ends for the same span, and only the first applies.
    const appliedCounts = new Map<string, number>();
    for (const span of updated) {
      const key = `${span.traceId}:${span.spanId}`;
      appliedCounts.set(key, (appliedCounts.get(key) ?? 0) + 1);
    }
    const retryable: BufferedEvent[] = [];
    let alreadyEnded = 0;
    for (const event of events) {
      const span = event.exportedSpan;
      const key = `${span.traceId}:${span.id}`;
      const remaining = appliedCounts.get(key) ?? 0;
      if (remaining > 0) {
        appliedCounts.set(key, remaining - 1);
      } else if (this.#eventBuffer.spanExists(span)) {
        alreadyEnded++;
      } else {
        retryable.push(event);
      }
    }
    if (retryable.length === 0 && alreadyEnded === 0) return false;

    const dropped = this.#eventBuffer.reAddUpdates(retryable, this.retryDelay);
    const notApplied = alreadyEnded + dropped.length;
    if (notApplied > 0) {
      this.logger.debug('Span updates dropped: span not stored or already ended', { count: notApplied });
      this.emitDrop('tracing', 'span-not-updatable', notApplied);
    }
    const retryAttempt = this.retryAttempt(retryable);
    if (retryAttempt !== undefined) {
      this.logger.debug('Span updates not applied yet, waiting for the span to be stored', {
        count: retryable.length - dropped.length,
        retryAttempt,
        nextRetryDelayMs: this.retryDelay(retryAttempt),
      });
    }
    return retryAttempt !== undefined;
  }

  /**
   * Runs flushBuffer() and tracks its promise so flush() can wait for writes
   * that a timer or size trigger started on their own.
   */
  private trackFlushBuffer(options?: { force: boolean }): Promise<void> {
    const promise = this.flushBuffer(options).finally(() => this.#inFlightFlushes.delete(promise));
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
   * Updates waiting out a retry delay stay buffered unless `force` is set.
   */
  private async flushBuffer({ force = false } = {}): Promise<void> {
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

    // Take the due events so new ones can accumulate during the flush
    const { creates, updates } = this.#eventBuffer.take({ all: force });
    if (creates.length === 0 && updates.length === 0) {
      this.scheduleWaitingRetries();
      return;
    }

    const startTime = Date.now();
    const batchSize = creates.length + updates.length;

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
    const flushResults = await Promise.all([
      this.flushCreates('feedback', createFeedbackEvents, events =>
        this.#observabilityStorage!.batchCreateFeedback({ feedbacks: events.map(f => buildFeedbackRecord(f)) }),
      ),
      this.flushCreates('log', createLogEvents, events =>
        this.#observabilityStorage!.batchCreateLogs({ logs: events.map(l => buildLogRecord(l)) }),
      ),
      this.flushCreates('metric', createMetricEvents, events =>
        this.#observabilityStorage!.batchCreateMetrics({ metrics: events.map(m => buildMetricRecord(m)) }),
      ),
      this.flushCreates('score', createScoreEvents, events =>
        this.#observabilityStorage!.batchCreateScores({ scores: events.map(s => buildScoreRecord(s)) }),
      ),
      this.flushCreates('tracing', createSpanEvents, async events => {
        const records = events.map(t => buildCreateSpanRecord(t.exportedSpan));
        await this.#observabilityStorage!.batchCreateSpans({ records });
        this.#eventBuffer.addCreatedSpans({ records });
      }),
    ]);

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
      this.scheduleFlush(this.retryDelay(retryAttempt));
    }
    this.scheduleWaitingRetries();

    if (!flushResults.some(result => result.failed) && deferredDropCount === 0) {
      const elapsed = Date.now() - startTime;
      this.logger.debug('Batch flushed', {
        strategy: this.#resolvedStrategy,
        batchSize,
        durationMs: elapsed,
        deferredUpdates: deferredUpdates.length > 0 ? deferredUpdates.length : undefined,
      });
    }
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
   *
   * An update still waiting out its retry delay is sent too, so a span whose row has landed
   * since is ended before the caller exits. One that still doesn't apply keeps its retry
   * count and due time: an Inngest worker flushes after every run, and those flushes must
   * not spend the retry budget.
   */
  async flush(): Promise<void> {
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
        await this.trackFlushBuffer({ force: true });
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
    // flush() made the last attempt at every waiting update, and nothing retries once we
    // return. The recipients of drop events shut down alongside this exporter, so report
    // the stranded updates before the first await, while they still listen. Events that
    // never got a flush, or a write still in flight, get one first.
    if (this.#eventBuffer.hasDueEvents || this.#inFlightFlushes.size > 0) {
      await this.flush();
    }
    clearTimeout(this.#flushTimer);
    this.#flushTimer = undefined;
    const { creates, updates } = this.#eventBuffer.take({ all: true });
    const stranded = [...creates, ...updates];
    if (stranded.length > 0) {
      this.logger.debug('Dropped events still waiting for a retry at shutdown', { count: stranded.length });
      const counts = new Map<ObservabilityDropSignal, number>();
      for (const event of stranded) {
        counts.set(dropSignal(event), (counts.get(dropSignal(event)) ?? 0) + 1);
      }
      for (const [signal, count] of counts) {
        this.emitDrop(signal, 'retry-exhausted', count);
      }
    }

    this.logger.info('MastraStorageExporter shutdown complete');
  }
}
