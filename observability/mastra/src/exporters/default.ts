import type { IMastraLogger } from '@mastra/core/logger';
import type { TracingEvent, AnyExportedSpan, InitExporterOptions } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import type {
  MastraStorage,
  CreateSpanRecord,
  UpdateSpanRecord,
  ObservabilityStorage,
  TracingStorageStrategy,
} from '@mastra/core/storage';
import type { BufferedExporterConfig } from './buffered';
import { BufferedExporter } from './buffered';

interface DefaultExporterConfig extends BufferedExporterConfig {
  maxBufferSize?: number; // Default: 10000 spans (overflow threshold)

  // Strategy selection (optional)
  strategy?: TracingStorageStrategy | 'auto';
}

interface BatchBuffer {
  // For batch-with-updates strategy
  creates: CreateSpanRecord[];
  updates: UpdateRecord[];

  // For insert-only strategy
  insertOnly: CreateSpanRecord[];

  // Ordering enforcement (batch-with-updates only)
  seenSpans: Set<string>; // "traceId:spanId" combinations we've seen creates for
  spanSequences: Map<string, number>; // "traceId:spanId" -> next sequence number

  // Track completed spans for cleanup
  completedSpans: Set<string>; // Spans that have received SPAN_ENDED

  // Metrics
  outOfOrderCount: number;
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

export class DefaultExporter extends BufferedExporter<BatchBuffer, BatchBuffer> {
  name = 'mastra-default-observability-exporter';

  #storage?: MastraStorage;
  #observability?: ObservabilityStorage;
  #userConfig: DefaultExporterConfig;
  #resolvedStrategy: TracingStorageStrategy;
  #maxBufferSize: number;

  private buffer: BatchBuffer;

  // Track all spans that have been created, persists across flushes
  private allCreatedSpans: Set<string> = new Set();

  #strategyInitialized = false;

  constructor(config: DefaultExporterConfig = {}) {
    super({
      ...config,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: config.maxRetries ?? 4,
      retryDelayMs: config.retryDelayMs ?? 500,
    });

    this.#userConfig = config;
    this.#maxBufferSize = config.maxBufferSize ?? 10000;

    // Initialize buffer
    this.buffer = this.createEmptyBuffer();

    // Resolve strategy - we'll do this lazily on first export since we need storage
    this.#resolvedStrategy = 'batch-with-updates'; // temporary default
  }

  private createEmptyBuffer(): BatchBuffer {
    return {
      creates: [],
      updates: [],
      insertOnly: [],
      seenSpans: new Set(),
      spanSequences: new Map(),
      completedSpans: new Set(),
      outOfOrderCount: 0,
    };
  }

  /**
   * Initialize the exporter (called after all dependencies are ready)
   */
  async init(options: InitExporterOptions): Promise<void> {
    this.#storage = options.mastra?.getStorage();
    if (!this.#storage) {
      this.logger.warn('DefaultExporter disabled: Storage not available. Traces will not be persisted.');
      return;
    }

    this.#observability = await this.#storage.getStore('observability');
    if (!this.#observability) {
      this.logger.warn('DefaultExporter disabled: Observability storage not available. Traces will not be persisted.');
      return;
    }

    this.initializeStrategy(this.#observability, this.#storage.constructor.name);
  }

  /**
   * Initialize the resolved strategy once observability store is available
   */
  private initializeStrategy(observability: ObservabilityStorage, storageName: string): void {
    if (this.#strategyInitialized) return;

    this.#resolvedStrategy = resolveTracingStorageStrategy(this.#userConfig, observability, storageName, this.logger);
    this.#strategyInitialized = true;

    this.logger.debug('tracing storage exporter initialized', {
      strategy: this.#resolvedStrategy,
      source: this.#userConfig.strategy !== 'auto' ? 'user' : 'auto',
      storageAdapter: storageName,
      maxBatchSize: this.maxBatchSize,
      maxBatchWaitMs: this.maxBatchWaitMs,
    });
  }

  // ==================== BufferedExporter Implementation ====================

  /**
   * Override _exportTracingEvent to handle realtime strategy specially.
   * Realtime strategy doesn't buffer - it processes events immediately.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (!this.#observability) {
      this.logger.debug('Cannot store traces. Observability storage is not initialized');
      return;
    }

    // Initialize strategy if not already done (fallback for edge cases)
    if (!this.#strategyInitialized) {
      this.initializeStrategy(this.#observability, this.#storage?.constructor.name ?? 'Unknown');
    }

    // Realtime strategy handles events immediately without buffering
    if (this.#resolvedStrategy === 'realtime') {
      await this.handleRealtimeEvent(event, this.#observability);
      return;
    }

    // For batch strategies, use the parent's buffering logic
    await super._exportTracingEvent(event);
  }

  /**
   * Process an event and add it to the buffer.
   */
  protected processEvent(event: TracingEvent): boolean {
    const spanKey = this.buildSpanKey(event.exportedSpan.traceId, event.exportedSpan.id);

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

    // Update buffer size tracking
    this.updateBufferSize(this.getBufferSize());
    return true;
  }

  /**
   * Get the current buffer size.
   */
  protected getBufferSize(): number {
    return this.buffer.creates.length + this.buffer.updates.length + this.buffer.insertOnly.length;
  }

  /**
   * Extract and reset the buffer.
   */
  protected extractAndResetBuffer(): BatchBuffer {
    const bufferCopy: BatchBuffer = {
      creates: [...this.buffer.creates],
      updates: [...this.buffer.updates],
      insertOnly: [...this.buffer.insertOnly],
      seenSpans: new Set(this.buffer.seenSpans),
      spanSequences: new Map(this.buffer.spanSequences),
      completedSpans: new Set(this.buffer.completedSpans),
      outOfOrderCount: this.buffer.outOfOrderCount,
    };

    // Reset buffer
    this.buffer = this.createEmptyBuffer();

    return bufferCopy;
  }

  /**
   * Called after buffer is reset - clean up completed spans from persistent tracking.
   */
  protected onBufferReset(): void {
    // Note: completedSpans cleanup is handled after successful flush in sendBatch
    super.onBufferReset();
  }

  /**
   * Check if buffer should be flushed - includes overflow check.
   */
  protected shouldFlush(): boolean {
    // Emergency flush - buffer overflow
    if (this.getBufferSize() >= this.#maxBufferSize) {
      return true;
    }
    return super.shouldFlush();
  }

  /**
   * Send the batch to storage.
   */
  protected async sendBatch(buffer: BatchBuffer): Promise<void> {
    if (!this.#observability) {
      return;
    }

    if (this.#resolvedStrategy === 'batch-with-updates') {
      // Process creates first (always safe)
      if (buffer.creates.length > 0) {
        await this.#observability.batchCreateSpans({ records: buffer.creates });
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

        await this.#observability.batchUpdateSpans({ records: sortedUpdates });
      }
    } else if (this.#resolvedStrategy === 'insert-only') {
      // Simple batch insert for insert-only strategy
      if (buffer.insertOnly.length > 0) {
        await this.#observability.batchCreateSpans({ records: buffer.insertOnly });
      }
    }

    // Clean up completed spans from persistent tracking after successful flush
    for (const spanKey of buffer.completedSpans) {
      this.allCreatedSpans.delete(spanKey);
    }

    if (buffer.outOfOrderCount > 0) {
      this.logger.debug('Batch flushed with out-of-order events', {
        outOfOrderCount: buffer.outOfOrderCount,
      });
    }
  }

  // ==================== Helper Methods ====================

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

  async shutdown(): Promise<void> {
    // Flush any remaining events
    if (this.getBufferSize() > 0) {
      this.logger.info('Flushing remaining events on shutdown', {
        remainingEvents: this.getBufferSize(),
      });
    }

    await super.shutdown();
    this.logger.info('DefaultExporter shutdown complete');
  }
}
