import type { IMastraLogger } from '@mastra/core/logger';
import type {
  TracingEvent,
  AnyExportedSpan,
  InitExporterOptions,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import { EntityType, TracingEventType } from '@mastra/core/observability';
import type {
  MastraStorage,
  CreateSpanRecord,
  UpdateSpanRecord,
  ObservabilityStorage,
  TracingStorageStrategy,
  CreateMetricRecord,
} from '@mastra/core/storage';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';

interface DefaultExporterConfig extends BaseExporterConfig {
  maxBatchSize?: number; // Default: 1000 spans
  maxBufferSize?: number; // Default: 10000 spans
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number; // Default: 4
  retryDelayMs?: number; // Default: 500ms (base delay for exponential backoff)

  // Strategy selection (optional)
  strategy?: TracingStorageStrategy | 'auto';

  // Whether to emit metric events for scores and feedback
  emitScoreFeedbackMetrics?: boolean;
}

interface BatchBuffer {
  // For batch-with-updates strategy
  creates: CreateSpanRecord[];
  updates: UpdateRecord[];

  // For insert-only strategy
  insertOnly: CreateSpanRecord[];

  // For span-events strategy (all events become creates)
  spanEvents: CreateSpanRecord[];

  // Ordering enforcement (batch-with-updates only)
  seenSpans: Set<string>; // "traceId:spanId" combinations we've seen creates for
  spanSequences: Map<string, number>; // "traceId:spanId" -> next sequence number

  // Track completed spans for cleanup
  completedSpans: Set<string>; // Spans that have received SPAN_ENDED

  // Metrics
  outOfOrderCount: number;

  // Metadata
  firstEventTime?: Date;
  totalSize: number;
}

interface UpdateRecord {
  traceId: string;
  spanId: string;
  updates: Partial<UpdateSpanRecord>;
  sequenceNumber: number; // For ordering updates to same span
}

/**
 * Resolves the final tracing storage strategy based on config and observability store hints
 */
function resolveTracingStorageStrategy(
  config: DefaultExporterConfig,
  observability: ObservabilityStorage,
  storageName: string,
  logger: IMastraLogger,
): TracingStorageStrategy {
  if (config.strategy && config.strategy !== 'auto') {
    const hints = observability.tracingStrategy;
    if (hints.supported.includes(config.strategy)) {
      return config.strategy;
    }
    // Log warning and fall through to auto-selection
    logger.warn('User-specified tracing strategy not supported by storage adapter, falling back to auto-selection', {
      userStrategy: config.strategy,
      storageAdapter: storageName,
      supportedStrategies: hints.supported,
      fallbackStrategy: hints.preferred,
    });
  }
  return observability.tracingStrategy.preferred;
}

// Helper to safely extract string from metadata
function getStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// Helper to safely extract object from metadata
function getObjectOrNull(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null;
}

// Helper to extract a key from a labels record and remove it
function extractAndRemove(labels: Record<string, string>, key: string): string | undefined {
  const value = labels[key];
  if (value !== undefined) {
    delete labels[key];
  }
  return value;
}

// Helper to safely cast string to EntityType
const entityTypeValues = new Set(Object.values(EntityType));
function toEntityType(value: string | undefined | null): EntityType | null {
  if (value && entityTypeValues.has(value as EntityType)) {
    return value as EntityType;
  }
  return null;
}

type Resolve = (value: void | PromiseLike<void>) => void;

export class DefaultExporter extends BaseExporter {
  name = 'mastra-default-observability-exporter';

  #storage?: MastraStorage;
  #observability?: ObservabilityStorage;
  #config: DefaultExporterConfig;
  #resolvedStrategy: TracingStorageStrategy;
  private buffer: BatchBuffer;
  #flushTimer: NodeJS.Timeout | null = null;

  #isInitializing = false;
  #initPromises: Set<Resolve> = new Set();

  // Track all spans that have been created, persists across flushes
  private allCreatedSpans: Set<string> = new Set();

  constructor(config: DefaultExporterConfig = {}) {
    super(config);

    if (config === undefined) {
      config = {};
    }

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

    // Initialize buffer
    this.buffer = {
      creates: [],
      updates: [],
      insertOnly: [],
      spanEvents: [],
      seenSpans: new Set(),
      spanSequences: new Map(),
      completedSpans: new Set(),
      outOfOrderCount: 0,
      totalSize: 0,
    };

    // Resolve strategy - we'll do this lazily on first export since we need storage
    this.#resolvedStrategy = 'batch-with-updates'; // temporary default
  }

  #strategyInitialized = false;

  /**
   * Initialize the exporter (called after all dependencies are ready)
   */
  async init(options: InitExporterOptions): Promise<void> {
    try {
      this.#isInitializing = true;

      this.#storage = options.mastra?.getStorage();
      if (!this.#storage) {
        this.logger.warn('DefaultExporter disabled: Storage not available. Traces will not be persisted.');
        return;
      }

      this.#observability = await this.#storage.getStore('observability');
      if (!this.#observability) {
        this.logger.warn(
          'DefaultExporter disabled: Observability storage not available. Traces will not be persisted.',
        );
        return;
      }

      this.initializeStrategy(this.#observability, this.#storage.constructor.name);
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
   * Initialize the resolved strategy once observability store is available
   */
  private initializeStrategy(observability: ObservabilityStorage, storageName: string): void {
    if (this.#strategyInitialized) return;

    this.#resolvedStrategy = resolveTracingStorageStrategy(this.#config, observability, storageName, this.logger);
    this.#strategyInitialized = true;

    this.logger.debug('tracing storage exporter initialized', {
      strategy: this.#resolvedStrategy,
      source: this.#config.strategy !== 'auto' ? 'user' : 'auto',
      storageAdapter: storageName,
      maxBatchSize: this.#config.maxBatchSize,
      maxBatchWaitMs: this.#config.maxBatchWaitMs,
    });
  }

  /**
   * Builds a unique span key for tracking
   */
  private buildSpanKey(traceId: string, spanId: string): string {
    return `${traceId}:${spanId}`;
  }

  /**
   * Gets the next sequence number for a span
   */
  private getNextSequence(spanKey: string): number {
    const current = this.buffer.spanSequences.get(spanKey) || 0;
    const next = current + 1;
    this.buffer.spanSequences.set(spanKey, next);
    return next;
  }

  /**
   * Handles out-of-order span updates by logging and skipping
   */
  private handleOutOfOrderUpdate(event: TracingEvent): void {
    this.logger.warn('Out-of-order span update detected - skipping event', {
      spanId: event.exportedSpan.id,
      traceId: event.exportedSpan.traceId,
      spanName: event.exportedSpan.name,
      eventType: event.type,
    });
  }

  /**
   * Adds an event to the appropriate buffer based on strategy
   */
  private addToBuffer(event: TracingEvent): void {
    const spanKey = this.buildSpanKey(event.exportedSpan.traceId, event.exportedSpan.id);

    // Set first event time if buffer is empty
    if (this.buffer.totalSize === 0) {
      this.buffer.firstEventTime = new Date();
    }

    // Handle span-events strategy — routes lifecycle events to creates/updates
    // so that DuckDB adapter correctly sets eventType ('start', 'update', 'end').
    // Unlike batch-with-updates, no out-of-order checking is needed because
    // all operations are append-only INSERTs in DuckDB.
    if (this.#resolvedStrategy === 'span-events') {
      switch (event.type) {
        case TracingEventType.SPAN_STARTED: {
          const createRecord = this.buildCreateRecord(event.exportedSpan);
          this.buffer.spanEvents.push(createRecord);
          this.allCreatedSpans.add(spanKey);
          break;
        }
        case TracingEventType.SPAN_UPDATED: {
          this.buffer.updates.push({
            traceId: event.exportedSpan.traceId,
            spanId: event.exportedSpan.id,
            updates: this.buildUpdateRecord(event.exportedSpan),
            sequenceNumber: this.getNextSequence(spanKey),
          });
          break;
        }
        case TracingEventType.SPAN_ENDED: {
          if (event.exportedSpan.isEvent) {
            // Event-type spans only emit SPAN_ENDED (no SPAN_STARTED)
            const createRecord = this.buildCreateRecord(event.exportedSpan);
            this.buffer.spanEvents.push(createRecord);
            this.allCreatedSpans.add(spanKey);
          } else {
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: this.buildUpdateRecord(event.exportedSpan),
              sequenceNumber: this.getNextSequence(spanKey),
            });
          }
          this.buffer.completedSpans.add(spanKey);
          this.allCreatedSpans.add(spanKey);
          break;
        }
      }
      // Update total size and return
      this.buffer.totalSize =
        this.buffer.creates.length +
        this.buffer.updates.length +
        this.buffer.insertOnly.length +
        this.buffer.spanEvents.length;
      return;
    }

    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        if (this.#resolvedStrategy === 'batch-with-updates') {
          const createRecord = this.buildCreateRecord(event.exportedSpan);
          this.buffer.creates.push(createRecord);
          this.buffer.seenSpans.add(spanKey);
          // Track this span as created persistently
          this.allCreatedSpans.add(spanKey);
        }
        // insert-only ignores SPAN_STARTED
        break;

      case TracingEventType.SPAN_UPDATED:
        if (this.#resolvedStrategy === 'batch-with-updates') {
          if (this.allCreatedSpans.has(spanKey)) {
            // Span was created previously (possibly in a prior batch)
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: this.buildUpdateRecord(event.exportedSpan),
              sequenceNumber: this.getNextSequence(spanKey),
            });
          } else {
            // Out-of-order case: log and skip
            this.handleOutOfOrderUpdate(event);
            this.buffer.outOfOrderCount++;
          }
        }
        // insert-only ignores SPAN_UPDATED
        break;

      case TracingEventType.SPAN_ENDED:
        if (this.#resolvedStrategy === 'batch-with-updates') {
          if (this.allCreatedSpans.has(spanKey)) {
            // Span was created previously (possibly in a prior batch)
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: this.buildUpdateRecord(event.exportedSpan),
              sequenceNumber: this.getNextSequence(spanKey),
            });
            // Mark this span as completed
            this.buffer.completedSpans.add(spanKey);
          } else if (event.exportedSpan.isEvent) {
            // Event-type spans only emit SPAN_ENDED (no prior SPAN_STARTED)
            const createRecord = this.buildCreateRecord(event.exportedSpan);
            this.buffer.creates.push(createRecord);
            this.buffer.seenSpans.add(spanKey);
            // Track this span as created persistently
            this.allCreatedSpans.add(spanKey);
            // Event spans are immediately complete
            this.buffer.completedSpans.add(spanKey);
          } else {
            // Out-of-order case: log and skip
            this.handleOutOfOrderUpdate(event);
            this.buffer.outOfOrderCount++;
          }
        } else if (this.#resolvedStrategy === 'insert-only') {
          // Only process SPAN_ENDED for insert-only strategy
          const createRecord = this.buildCreateRecord(event.exportedSpan);
          this.buffer.insertOnly.push(createRecord);
          // Mark as completed for insert-only strategy
          this.buffer.completedSpans.add(spanKey);
          this.allCreatedSpans.add(spanKey);
        }
        break;
    }

    // Update total size
    this.buffer.totalSize =
      this.buffer.creates.length +
      this.buffer.updates.length +
      this.buffer.insertOnly.length +
      this.buffer.spanEvents.length;
  }

  /**
   * Checks if buffer should be flushed based on size or time triggers
   */
  private shouldFlush(): boolean {
    // Emergency flush - buffer overflow
    if (this.buffer.totalSize >= this.#config.maxBufferSize!) {
      return true;
    }

    // Size-based flush
    if (this.buffer.totalSize >= this.#config.maxBatchSize!) {
      return true;
    }

    // Time-based flush
    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.#config.maxBatchWaitMs!) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resets the buffer after successful flush
   */
  private resetBuffer(completedSpansToCleanup: Set<string> = new Set()): void {
    this.buffer.creates = [];
    this.buffer.updates = [];
    this.buffer.insertOnly = [];
    this.buffer.spanEvents = [];
    this.buffer.seenSpans.clear();
    this.buffer.spanSequences.clear();
    this.buffer.completedSpans.clear();
    this.buffer.outOfOrderCount = 0;
    this.buffer.firstEventTime = undefined;
    this.buffer.totalSize = 0;

    // Clean up completed spans from persistent tracking
    for (const spanKey of completedSpansToCleanup) {
      this.allCreatedSpans.delete(spanKey);
    }
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
   * Serializes span attributes to storage record format
   * Handles all Span types and their specific attributes
   */
  private serializeAttributes(span: AnyExportedSpan): Record<string, any> | null {
    if (!span.attributes) {
      return null;
    }

    try {
      // Convert the typed attributes to a plain object
      // This handles nested objects, dates, and other complex types
      return JSON.parse(
        JSON.stringify(span.attributes, (_key, value) => {
          // Handle Date objects
          if (value instanceof Date) {
            return value.toISOString();
          }
          // Handle other objects that might not serialize properly
          if (typeof value === 'object' && value !== null) {
            // For arrays and plain objects, let JSON.stringify handle them
            return value;
          }
          // For primitives, return as-is
          return value;
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to serialize span attributes, storing as null', {
        spanId: span.id,
        spanType: span.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private buildCreateRecord(span: AnyExportedSpan): CreateSpanRecord {
    const metadata = span.metadata ?? {};

    return {
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,

      // Entity identification - from span
      entityType: span.entityType ?? null,
      entityId: span.entityId ?? null,
      entityName: span.entityName ?? null,

      // Identity & Tenancy - extracted from metadata if present
      userId: getStringOrNull(metadata.userId),
      organizationId: getStringOrNull(metadata.organizationId),
      resourceId: getStringOrNull(metadata.resourceId),

      // Correlation IDs - extracted from metadata if present
      runId: getStringOrNull(metadata.runId),
      sessionId: getStringOrNull(metadata.sessionId),
      threadId: getStringOrNull(metadata.threadId),
      requestId: getStringOrNull(metadata.requestId),

      // Deployment context - extracted from metadata if present
      environment: getStringOrNull(metadata.environment),
      source: getStringOrNull(metadata.source),
      serviceName: getStringOrNull(metadata.serviceName),
      scope: getObjectOrNull(metadata.scope),

      // Span data
      spanType: span.type,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null, // Keep all metadata including extracted fields
      tags: span.tags ?? null,
      links: null,
      input: span.input ?? null,
      output: span.output ?? null,
      error: span.errorInfo ?? null,
      isEvent: span.isEvent,

      // Timestamps
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
    };
  }

  private buildUpdateRecord(span: AnyExportedSpan): Partial<UpdateSpanRecord> {
    return {
      name: span.name,
      scope: null,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo ?? null,
    };
  }

  /**
   * Handles realtime strategy - processes each event immediately
   */
  private async handleRealtimeEvent(event: TracingEvent, observability: ObservabilityStorage): Promise<void> {
    const span = event.exportedSpan;
    const spanKey = this.buildSpanKey(span.traceId, span.id);

    // Event spans only have an end event
    if (span.isEvent) {
      if (event.type === TracingEventType.SPAN_ENDED) {
        await observability.createSpan({ span: this.buildCreateRecord(event.exportedSpan) });
        // For event spans in realtime, we don't need to track them since they're immediately complete
      } else {
        this.logger.warn(`Tracing event type not implemented for event spans: ${event.type}`);
      }
    } else {
      switch (event.type) {
        case TracingEventType.SPAN_STARTED:
          await observability.createSpan({ span: this.buildCreateRecord(event.exportedSpan) });
          // Track this span as created persistently
          this.allCreatedSpans.add(spanKey);
          break;
        case TracingEventType.SPAN_UPDATED:
          await observability.updateSpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: this.buildUpdateRecord(span),
          });
          break;
        case TracingEventType.SPAN_ENDED:
          await observability.updateSpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: this.buildUpdateRecord(span),
          });
          // Clean up immediately for realtime strategy
          this.allCreatedSpans.delete(spanKey);
          break;
        default:
          this.logger.warn(`Tracing event type not implemented for span spans: ${(event as any).type}`);
      }
    }
  }

  /**
   * Handles batch-with-updates strategy - buffers events and processes in batches
   */
  private handleBatchWithUpdatesEvent(event: TracingEvent): void {
    this.addToBuffer(event);

    if (this.shouldFlush()) {
      // Immediate flush for size/emergency triggers
      this.flushBuffer().catch(error => {
        this.logger.error('Batch flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else if (this.buffer.totalSize === 1) {
      // Schedule flush for the first event in buffer
      this.scheduleFlush();
    }
  }

  /**
   * Handles span-events strategy - buffers ALL lifecycle events as creates (append-only)
   */
  private handleSpanEventsEvent(event: TracingEvent): void {
    this.addToBuffer(event);

    if (this.shouldFlush()) {
      this.flushBuffer().catch(error => {
        this.logger.error('Batch flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else if (this.buffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }

  /**
   * Handles insert-only strategy - only processes SPAN_ENDED events in batches
   */
  private handleInsertOnlyEvent(event: TracingEvent): void {
    // Only process SPAN_ENDED events for insert-only strategy
    if (event.type === TracingEventType.SPAN_ENDED) {
      this.addToBuffer(event);

      if (this.shouldFlush()) {
        // Immediate flush for size/emergency triggers
        this.flushBuffer().catch(error => {
          this.logger.error('Batch flush failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } else if (this.buffer.totalSize === 1) {
        // Schedule flush for the first event in buffer
        this.scheduleFlush();
      }
    }
    // Ignore SPAN_STARTED and SPAN_UPDATED events
  }

  /**
   * Calculates retry delay using exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return this.#config.retryDelayMs! * Math.pow(2, attempt);
  }

  /**
   * Flushes the current buffer to storage with retry logic (internal implementation)
   */
  private async flushBuffer(): Promise<void> {
    if (!this.#observability) {
      this.logger.debug('Cannot flush traces. Observability storage is not initialized');
      return;
    }

    // Clear timer since we're flushing
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    if (this.buffer.totalSize === 0) {
      return; // Nothing to flush
    }

    const startTime = Date.now();
    const flushReason =
      this.buffer.totalSize >= this.#config.maxBufferSize!
        ? 'overflow'
        : this.buffer.totalSize >= this.#config.maxBatchSize!
          ? 'size'
          : 'time';

    // Create a copy of the buffer to work with
    const bufferCopy: BatchBuffer = {
      creates: [...this.buffer.creates],
      updates: [...this.buffer.updates],
      insertOnly: [...this.buffer.insertOnly],
      spanEvents: [...this.buffer.spanEvents],
      seenSpans: new Set(this.buffer.seenSpans),
      spanSequences: new Map(this.buffer.spanSequences),
      completedSpans: new Set(this.buffer.completedSpans),
      outOfOrderCount: this.buffer.outOfOrderCount,
      firstEventTime: this.buffer.firstEventTime,
      totalSize: this.buffer.totalSize,
    };

    // Reset buffer immediately to prevent blocking new events
    // Note: We don't clean up completed spans yet - we'll do that after successful flush
    this.resetBuffer();

    // Attempt to flush with retry logic
    await this.flushWithRetries(this.#observability, bufferCopy, 0);

    const elapsed = Date.now() - startTime;
    this.logger.debug('Batch flushed', {
      strategy: this.#resolvedStrategy,
      batchSize: bufferCopy.totalSize,
      flushReason,
      durationMs: elapsed,
      outOfOrderCount: bufferCopy.outOfOrderCount > 0 ? bufferCopy.outOfOrderCount : undefined,
    });
  }

  /**
   * Attempts to flush with exponential backoff retry logic
   */
  private async flushWithRetries(
    observability: ObservabilityStorage,
    buffer: BatchBuffer,
    attempt: number,
  ): Promise<void> {
    try {
      if (this.#resolvedStrategy === 'batch-with-updates') {
        // Process creates first (always safe)
        if (buffer.creates.length > 0) {
          await observability.batchCreateSpans({ records: buffer.creates });
        }

        // Sort updates by span, then by sequence number
        if (buffer.updates.length > 0) {
          const sortedUpdates = buffer.updates.sort((a, b) => {
            const spanCompare = this.buildSpanKey(a.traceId, a.spanId).localeCompare(
              this.buildSpanKey(b.traceId, b.spanId),
            );
            if (spanCompare !== 0) return spanCompare;
            return a.sequenceNumber - b.sequenceNumber;
          });

          await observability.batchUpdateSpans({ records: sortedUpdates });
        }
      } else if (this.#resolvedStrategy === 'insert-only') {
        // Simple batch insert for insert-only strategy
        if (buffer.insertOnly.length > 0) {
          await observability.batchCreateSpans({ records: buffer.insertOnly });
        }
      } else if (this.#resolvedStrategy === 'span-events') {
        // Span-events strategy: creates go via batchCreateSpans (eventType='start'),
        // updates/ends go via batchUpdateSpans (eventType='update'/'end')
        if (buffer.spanEvents.length > 0) {
          await observability.batchCreateSpans({ records: buffer.spanEvents });
        }
        if (buffer.updates.length > 0) {
          const sortedUpdates = buffer.updates.sort((a, b) => {
            const spanCompare = this.buildSpanKey(a.traceId, a.spanId).localeCompare(
              this.buildSpanKey(b.traceId, b.spanId),
            );
            if (spanCompare !== 0) return spanCompare;
            return a.sequenceNumber - b.sequenceNumber;
          });
          await observability.batchUpdateSpans({ records: sortedUpdates });
        }
      }

      // Success! Clean up completed spans from persistent tracking
      for (const spanKey of buffer.completedSpans) {
        this.allCreatedSpans.delete(spanKey);
      }
    } catch (error) {
      if (attempt < this.#config.maxRetries!) {
        const retryDelay = this.calculateRetryDelay(attempt);
        this.logger.warn('Batch flush failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.#config.maxRetries,
          nextRetryInMs: retryDelay,
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.flushWithRetries(observability, buffer, attempt + 1);
      } else {
        this.logger.error('Batch flush failed after all retries, dropping batch', {
          finalAttempt: attempt + 1,
          maxRetries: this.#config.maxRetries,
          droppedBatchSize: buffer.totalSize,
          error: error instanceof Error ? error.message : String(error),
        });
        // Even on failure, we should clean up completed spans to avoid memory leak
        // These spans will be lost but at least we prevent memory issues
        for (const spanKey of buffer.completedSpans) {
          this.allCreatedSpans.delete(spanKey);
        }
      }
    }
  }

  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observability) {
      this.logger.debug('Cannot store traces. Observability storage is not initialized');
      return;
    }

    // Initialize strategy if not already done (fallback for edge cases)
    if (!this.#strategyInitialized) {
      this.initializeStrategy(this.#observability, this.#storage?.constructor.name ?? 'Unknown');
    }

    // Clear strategy routing - explicit and readable
    switch (this.#resolvedStrategy) {
      case 'realtime':
        await this.handleRealtimeEvent(event, this.#observability);
        break;
      case 'batch-with-updates':
        this.handleBatchWithUpdatesEvent(event);
        break;
      case 'insert-only':
        this.handleInsertOnlyEvent(event);
        break;
      case 'span-events':
        this.handleSpanEventsEvent(event);
        break;
    }
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

  // ============================================================================
  // Non-tracing signal handlers
  // ============================================================================

  /**
   * Handle metric events — convert ExportedMetric to CreateMetricRecord,
   * extracting entity hierarchy from labels to first-class columns.
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observability) return;

    const m = event.metric;
    const labels = { ...m.labels };

    // Extract entity hierarchy fields from labels to first-class columns
    const entityType = extractAndRemove(labels, 'entity_type');
    const entityName = extractAndRemove(labels, 'entity_name');
    const parentType = extractAndRemove(labels, 'parent_type');
    const parentName = extractAndRemove(labels, 'parent_name');
    const rootType = extractAndRemove(labels, 'root_type');
    const rootName = extractAndRemove(labels, 'root_name');
    const serviceName = extractAndRemove(labels, 'service_name');

    const record: CreateMetricRecord = {
      id: crypto.randomUUID(),
      timestamp: m.timestamp,
      name: m.name,
      metricType: m.metricType,
      value: m.value,
      labels,
      entityType: toEntityType(entityType),
      entityName: entityName ?? null,
      parentEntityType: toEntityType(parentType),
      parentEntityName: parentName ?? null,
      rootEntityType: toEntityType(rootType),
      rootEntityName: rootName ?? null,
      serviceName: serviceName ?? null,
    };

    try {
      await this.#observability.batchRecordMetrics({ metrics: [record] });
    } catch (error) {
      this.logger.error('Failed to store metric event', {
        name: m.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle log events — forward to storage.
   */
  async onLogEvent(event: LogEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observability) return;

    const log = event.log;
    const metadata = log.metadata ?? {};

    try {
      await this.#observability.batchCreateLogs({
        logs: [
          {
            id: crypto.randomUUID(),
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            data: log.data ?? null,
            traceId: log.traceId ?? null,
            spanId: log.spanId ?? null,
            tags: log.tags ?? null,
            entityType: toEntityType(getStringOrNull(metadata.entity_type)),
            entityId: getStringOrNull(metadata.entity_id),
            entityName: getStringOrNull(metadata.entity_name),
            parentEntityType: toEntityType(getStringOrNull(metadata.parent_type)),
            parentEntityName: getStringOrNull(metadata.parent_name),
            rootEntityType: toEntityType(getStringOrNull(metadata.root_type)),
            rootEntityName: getStringOrNull(metadata.root_name),
            userId: getStringOrNull(metadata.userId),
            organizationId: getStringOrNull(metadata.organizationId),
            runId: getStringOrNull(metadata.runId),
            sessionId: getStringOrNull(metadata.sessionId),
            environment: getStringOrNull(metadata.environment),
            serviceName: getStringOrNull(metadata.serviceName),
            experimentId: getStringOrNull(metadata.experimentId),
            metadata: log.metadata ?? null,
          },
        ],
      });
    } catch (error) {
      this.logger.error('Failed to store log event', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle score events — forward to storage.
   */
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observability) return;

    const s = event.score;
    try {
      await this.#observability.createScore({
        score: {
          id: crypto.randomUUID(),
          timestamp: s.timestamp,
          traceId: s.traceId,
          spanId: s.spanId ?? null,
          scorerName: s.scorerName,
          score: s.score,
          reason: s.reason ?? null,
          experimentId: s.experimentId ?? null,
          metadata: s.metadata ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to store score event', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle feedback events — forward to storage.
   */
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    await this.waitForInit();
    if (!this.#observability) return;

    const fb = event.feedback;
    try {
      await this.#observability.createFeedback({
        feedback: {
          id: crypto.randomUUID(),
          timestamp: fb.timestamp,
          traceId: fb.traceId,
          spanId: fb.spanId ?? null,
          source: fb.source,
          feedbackType: fb.feedbackType,
          value: fb.value,
          comment: fb.comment ?? null,
          experimentId: fb.experimentId ?? null,
          metadata: fb.metadata ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to store feedback event', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    if (this.buffer.totalSize > 0) {
      this.logger.debug('Flushing buffered events', {
        bufferedEvents: this.buffer.totalSize,
      });
      await this.flushBuffer();
    }
  }

  async shutdown(): Promise<void> {
    // Clear any pending timer
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    // Flush any remaining events
    await this.flush();

    this.logger.info('DefaultExporter shutdown complete');
  }
}
