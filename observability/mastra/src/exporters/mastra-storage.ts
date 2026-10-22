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
  #spanReadsUnsupported = false;
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
      await this.trackFlushBuffer();
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
      const retryAttempt = this.retryAttempt(events);
      this.logStorageFailure(signal, events, retryAttempt, error);
      this.emitDrop(signal, 'retry-exhausted', dropped.length, error);
      return { failed: true, retryAttempt };
    }
  }

  /**
   * Flush span update/end events, deferring any whose span hasn't been created yet.
   * When `isEnd` is true, successfully flushed spans are removed from tracking.
   */
  private async flushSpanUpdates(
    events: (TracingEvent & RetryCount)[],
    deferredUpdates: BufferedEvent[],
    isEnd: boolean,
    persistedSpans: Map<string, boolean>,
  ): Promise<FlushResult> {
    const deferredCountAtEntry = deferredUpdates.length;
    if (events.length === 0) return FLUSH_SUCCEEDED;
    if (this.#unsupportedSignals.has('tracing')) {
      this.emitDrop('tracing', 'unsupported-storage', events.length);
      return { failed: true };
    }

    try {
      const partials: UpdateSpanPartial[] = [];
      for (const event of events) {
        const span = event.exportedSpan;
        let spanExists = this.#eventBuffer.spanExists(span);
        if (!spanExists && !this.#spanReadsUnsupported) {
          // Cache only for this flush: a missing span may be created before a retry.
          const key = `${span.traceId}:${span.id}`;
          const cached = persistedSpans.get(key);
          if (cached !== undefined) {
            spanExists = cached;
          } else if (typeof this.#observabilityStorage!.getSpan !== 'function') {
            this.#spanReadsUnsupported = true;
          } else {
            try {
              spanExists = !!(await this.#observabilityStorage!.getSpan({ traceId: span.traceId, spanId: span.id }));
              persistedSpans.set(key, spanExists);
            } catch (error) {
              // Write-only providers retain the existing create-before-update behavior.
              if (
                !(error instanceof MastraError) ||
                error.domain !== ErrorDomain.MASTRA_OBSERVABILITY ||
                error.id !== 'OBSERVABILITY_STORAGE_GET_SPAN_NOT_IMPLEMENTED'
              ) {
                throw error;
              }
              this.#spanReadsUnsupported = true;
            }
          }
        }
        if (spanExists) {
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

      await this.#observabilityStorage!.batchUpdateSpans({ records: partials });
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
   * Runs flushBuffer() and tracks its promise so flush() can wait for writes
   * that a timer or size trigger started on their own.
   */
  private trackFlushBuffer(): Promise<void> {
    const promise = this.flushBuffer().finally(() => this.#inFlightFlushes.delete(promise));
    this.#inFlightFlushes.add(promise);
    return promise;
  }

  /**
   * Flushes the current buffer to storage.
   *
   * Creates are flushed first, then their span keys are added to allCreatedSpans.
   * Updates are checked against allCreatedSpans and, on a cache miss, storage.
   * Those whose span has not been created are retried on the next flush.
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
    const creates = this.#eventBuffer.creates;
    const updates = this.#eventBuffer.updates;
    this.#eventBuffer.reset();

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

    const persistedSpans = new Map<string, boolean>();
    flushResults.push(await this.flushSpanUpdates(updateSpanEvents, deferredUpdates, false, persistedSpans));
    flushResults.push(await this.flushSpanUpdates(endSpanEvents, deferredUpdates, true, persistedSpans));

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

    this.#eventBuffer.addEvent(event);
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

    // Flush any remaining events
    await this.flush();

    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }

    this.logger.info('MastraStorageExporter shutdown complete');
  }
}
