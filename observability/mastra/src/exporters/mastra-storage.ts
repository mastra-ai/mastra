import { MastraError, ErrorDomain } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type {
  TracingEvent,
  InitExporterOptions,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
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

type Resolve = (value: void | PromiseLike<void>) => void;

/**
 * Storage-backed exporter. Buffers observability events and flushes them in
 * batches to the configured ObservabilityStorage backend with retry support.
 */
export class MastraStorageExporter extends BaseExporter {
  name = 'mastra-storage-exporter';

  #config: MastraStorageExporterConfig;
  #isInitializing = false;
  #initPromises: Set<Resolve> = new Set();
  #eventBuffer: EventBuffer;

  #storage?: MastraCompositeStore;
  #observabilityStorage?: ObservabilityStorage;
  #resolvedStrategy?: TracingStorageStrategy;
  #flushTimer?: NodeJS.Timeout;

  // Signals whose storage methods threw "not implemented" — skip on future flushes
  #unsupportedSignals: Set<string> = new Set();

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
    try {
      this.#isInitializing = true;

      this.#storage = options.mastra?.getStorage();
      if (!this.#storage) {
        this.logger.warn('MastraStorageExporter disabled: Storage not available. Traces will not be persisted.');
        return;
      }

      this.#observabilityStorage = await this.#storage.getStore('observability');
      if (!this.#observabilityStorage) {
        this.logger.warn(
          'MastraStorageExporter disabled: Observability storage not available. Traces will not be persisted.',
        );
        return;
      }

      // Initialize the resolved strategy once observability store is available
      if (!this.#resolvedStrategy) {
        this.#resolvedStrategy = resolveTracingStorageStrategy(
          this.#config,
          this.#observabilityStorage,
          this.#storage.constructor.name,
          this.logger,
        );

        this.logger.debug('tracing storage exporter initialized', {
          strategy: this.#resolvedStrategy,
          source: this.#config.strategy !== 'auto' ? 'user' : 'auto',
          storageAdapter: this.#storage.constructor.name,
          maxBatchSize: this.#config.maxBatchSize,
          maxBatchWaitMs: this.#config.maxBatchWaitMs,
        });
      }

      if (this.#resolvedStrategy) {
        this.#eventBuffer.init({ strategy: this.#resolvedStrategy });
      }
    } finally {
      this.#isInitializing = false;
      /**
       * Assumes caller waits until export of a parent span is completed before calling
       * export for child spans , order is not relevant for resolve
       */
      this.#initPromises.forEach(resolve => {
        resolve();
      });
      this.#initPromises.clear();
    }
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
  private scheduleFlush(): void {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
    }
    this.#flushTimer = setTimeout(() => {
      this.flushBuffer().catch(error => {
        this.logger.error('Scheduled flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.#config.maxBatchWaitMs);
  }

  /**
   * Checks flush triggers and schedules/triggers flush as needed.
   * Called after adding any event to the buffer.
   * Returns the flush promise when flushing so callers can await it.
   */
  private async handleBatchedFlush(): Promise<void> {
    if (this.shouldFlush()) {
      await this.flushBuffer();
    } else if (this.#eventBuffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }

  /**
   * Flush a batch of create events for a single signal type.
   * On "not implemented" errors, disables the signal for future flushes.
   * On other errors, re-adds events to the buffer for retry.
   */
  private async flushCreates<T extends BufferedEvent>(
    signal: string,
    events: T[],
    storageCall: (events: T[]) => Promise<void>,
  ): Promise<void> {
    if (this.#unsupportedSignals.has(signal) || events.length === 0) return;
    try {
      await storageCall(events);
    } catch (error) {
      if (
        error instanceof MastraError &&
        error.domain === ErrorDomain.MASTRA_OBSERVABILITY &&
        error.id.endsWith('_NOT_IMPLEMENTED')
      ) {
        this.logger.warn(error.message);
        this.#unsupportedSignals.add(signal);
      } else {
        this.#eventBuffer.reAddCreates(events);
      }
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
  ): Promise<void> {
    if (this.#unsupportedSignals.has('tracing') || events.length === 0) return;

    const partials: UpdateSpanPartial[] = [];
    for (const event of events) {
      const span = event.exportedSpan;
      if (this.#eventBuffer.spanExists(span)) {
        partials.push({
          traceId: span.traceId,
          spanId: span.id,
          updates: buildUpdateSpanRecord(span),
        });
      } else {
        deferredUpdates.push(event);
      }
    }

    if (partials.length === 0) return;

    try {
      await this.#observabilityStorage!.batchUpdateSpans({ records: partials });
      if (isEnd) {
        this.#eventBuffer.endFinishedSpans({ records: partials });
      }
    } catch (error) {
      if (
        error instanceof MastraError &&
        error.domain === ErrorDomain.MASTRA_OBSERVABILITY &&
        error.id.endsWith('_NOT_IMPLEMENTED')
      ) {
        this.logger.warn(error.message);
        this.#unsupportedSignals.add('tracing');
      } else {
        // Clear deferred to avoid double-adding — re-add all original events instead
        deferredUpdates.length = 0;
        this.#eventBuffer.reAddUpdates(events);
      }
    }
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
    await Promise.all([
      this.flushCreates('feedback', createFeedbackEvents, events =>
        this.#observabilityStorage!.batchCreateFeedback({ feedbacks: events.map(f => buildFeedbackRecord(f)) }),
      ),
      this.flushCreates('logs', createLogEvents, events =>
        this.#observabilityStorage!.batchCreateLogs({ logs: events.map(l => buildLogRecord(l)) }),
      ),
      this.flushCreates('metrics', createMetricEvents, events =>
        this.#observabilityStorage!.batchCreateMetrics({ metrics: events.map(m => buildMetricRecord(m)) }),
      ),
      this.flushCreates('scores', createScoreEvents, events =>
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

    await this.flushSpanUpdates(updateSpanEvents, deferredUpdates, false);
    await this.flushSpanUpdates(endSpanEvents, deferredUpdates, true);

    if (deferredUpdates.length > 0) {
      this.#eventBuffer.reAddUpdates(deferredUpdates);
    }

    const elapsed = Date.now() - startTime;
    this.logger.debug('Batch flushed', {
      strategy: this.#resolvedStrategy,
      batchSize,
      durationMs: elapsed,
      deferredUpdates: deferredUpdates.length > 0 ? deferredUpdates.length : undefined,
    });
    return; // Success
  }

  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observabilityStorage) {
      this.logger.debug('Cannot store traces. Observability storage is not initialized');
      return;
    }

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Resolves when an ongoing init call is finished
   * Doesn't wait for the caller to call init
   * @returns
   */
  private async waitForInit(): Promise<void> {
    if (!this.#isInitializing) return;
    return new Promise(resolve => {
      this.#initPromises.add(resolve);
    });
  }

  /**
   * Handle metric events — buffer for batch flush.
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle log events — buffer for batch flush.
   */
  async onLogEvent(event: LogEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle score events — buffer for batch flush.
   */
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observabilityStorage) return;

    this.#eventBuffer.addEvent(event);
    await this.handleBatchedFlush();
  }

  /**
   * Handle feedback events — buffer for batch flush.
   */
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    await this.waitForInit();
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
    if (this.#eventBuffer.totalSize > 0) {
      this.logger.debug('Flushing buffered events', {
        bufferedEvents: this.#eventBuffer.totalSize,
      });
      await this.flushBuffer();
    }
  }

  async shutdown(): Promise<void> {
    // Clear any pending timer
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }

    // Flush any remaining events
    await this.flush();

    this.logger.info('MastraStorageExporter shutdown complete');
  }
}
