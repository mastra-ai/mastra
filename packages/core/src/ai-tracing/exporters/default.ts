import { ConsoleLogger, LogLevel } from '../../logger';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage/base';
import type { AISpanRecord } from '../../storage/types';
import { AITracingEventType } from '../types';
import type { AITracingEvent, AITracingExporter, AnyExportedAISpan, TracingStrategy } from '../types';

type InternalAISpanRecord = Omit<AISpanRecord, 'spanId' | 'traceId' | 'createdAt' | 'updatedAt'>;

interface BatchingConfig {
  maxBatchSize?: number; // Default: 1000 spans
  maxBufferSize?: number; // Default: 10000 spans
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number; // Default: 4
  retryDelayMs?: number; // Default: 500ms (base delay for exponential backoff)

  // Strategy selection (optional)
  strategy?: TracingStrategy | 'auto';
}

interface BatchBuffer {
  // For batch-with-updates strategy
  creates: AISpanRecord[];
  updates: UpdateRecord[];

  // For insert-only strategy
  insertOnly: AISpanRecord[];

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
  updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  sequenceNumber: number; // For ordering updates to same span
}

/**
 * Resolves the final strategy based on user config and storage hints
 */
function resolveStrategy(userConfig: BatchingConfig, storage: MastraStorage, logger: IMastraLogger): TracingStrategy {
  if (userConfig.strategy && userConfig.strategy !== 'auto') {
    const hints = storage.aiTracingStrategy;
    if (hints.supported.includes(userConfig.strategy)) {
      return userConfig.strategy;
    }
    // Log warning and fall through to auto-selection
    logger.warn('User-specified AI tracing strategy not supported by storage adapter, falling back to auto-selection', {
      userStrategy: userConfig.strategy,
      storageAdapter: storage.constructor.name,
      supportedStrategies: hints.supported,
      fallbackStrategy: hints.preferred,
    });
  }
  return storage.aiTracingStrategy.preferred;
}

export class DefaultExporter implements AITracingExporter {
  name = 'tracing-default-exporter';
  private logger: IMastraLogger;
  private mastra: Mastra | null = null;
  private config: Required<BatchingConfig>;
  private resolvedStrategy: TracingStrategy;
  private buffer: BatchBuffer;
  private flushTimer: NodeJS.Timeout | null = null;

  // Track all spans that have been created, persists across flushes
  private allCreatedSpans: Set<string> = new Set();

  constructor(config: BatchingConfig = {}, logger?: IMastraLogger) {
    if (logger) {
      this.logger = logger;
    } else {
      // Fallback: create a direct ConsoleLogger instance if none provided
      this.logger = new ConsoleLogger({ level: LogLevel.INFO });
    }

    // Set default configuration
    this.config = {
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
      seenSpans: new Set(),
      spanSequences: new Map(),
      completedSpans: new Set(),
      outOfOrderCount: 0,
      totalSize: 0,
    };

    // Resolve strategy - we'll do this lazily on first export since we need storage
    this.resolvedStrategy = 'batch-with-updates'; // temporary default
  }

  private strategyInitialized = false;

  /**
   * Register the Mastra instance (called after Mastra construction is complete)
   */
  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  /**
   * Initialize the exporter (called after all dependencies are ready)
   */
  init(): void {
    if (!this.mastra) {
      throw new Error('DefaultExporter: init() called before __registerMastra()');
    }

    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.warn('DefaultExporter disabled: Storage not available. Traces will not be persisted.');
      return;
    }

    this.initializeStrategy(storage);
  }

  /**
   * Initialize the resolved strategy once storage is available
   */
  private initializeStrategy(storage: MastraStorage): void {
    if (this.strategyInitialized) return;

    this.resolvedStrategy = resolveStrategy(this.config, storage, this.logger);
    this.strategyInitialized = true;

    this.logger.info('AI tracing exporter initialized', {
      strategy: this.resolvedStrategy,
      source: this.config.strategy !== 'auto' ? 'user' : 'auto',
      storageAdapter: storage.constructor.name,
      maxBatchSize: this.config.maxBatchSize,
      maxBatchWaitMs: this.config.maxBatchWaitMs,
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
  private handleOutOfOrderUpdate(event: AITracingEvent): void {
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
  private addToBuffer(event: AITracingEvent): void {
    const spanKey = this.buildSpanKey(event.exportedSpan.traceId, event.exportedSpan.id);

    // Set first event time if buffer is empty
    if (this.buffer.totalSize === 0) {
      this.buffer.firstEventTime = new Date();
    }

    switch (event.type) {
      case AITracingEventType.SPAN_STARTED:
        if (this.resolvedStrategy === 'batch-with-updates') {
          const createRecord = {
            traceId: event.exportedSpan.traceId,
            spanId: event.exportedSpan.id,
            ...this.buildCreateRecord(event.exportedSpan),
            createdAt: new Date(),
            updatedAt: null,
          };
          this.buffer.creates.push(createRecord);
          this.buffer.seenSpans.add(spanKey);
          // Track this span as created persistently
          this.allCreatedSpans.add(spanKey);
        }
        // insert-only ignores SPAN_STARTED
        break;

      case AITracingEventType.SPAN_UPDATED:
        if (this.resolvedStrategy === 'batch-with-updates') {
          if (this.allCreatedSpans.has(spanKey)) {
            // Span was created previously (possibly in a prior batch)
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: {
                ...this.buildUpdateRecord(event.exportedSpan),
                updatedAt: new Date(),
              },
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

      case AITracingEventType.SPAN_ENDED:
        if (this.resolvedStrategy === 'batch-with-updates') {
          if (this.allCreatedSpans.has(spanKey)) {
            // Span was created previously (possibly in a prior batch)
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: {
                ...this.buildUpdateRecord(event.exportedSpan),
                updatedAt: new Date(),
              },
              sequenceNumber: this.getNextSequence(spanKey),
            });
            // Mark this span as completed
            this.buffer.completedSpans.add(spanKey);
          } else if (event.exportedSpan.isEvent) {
            // Event-type spans only emit SPAN_ENDED (no prior SPAN_STARTED)
            const createRecord = {
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              ...this.buildCreateRecord(event.exportedSpan),
              createdAt: new Date(),
              updatedAt: null,
            };
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
        } else if (this.resolvedStrategy === 'insert-only') {
          // Only process SPAN_ENDED for insert-only strategy
          const createRecord = {
            traceId: event.exportedSpan.traceId,
            spanId: event.exportedSpan.id,
            ...this.buildCreateRecord(event.exportedSpan),
            createdAt: new Date(),
            updatedAt: null,
          };
          this.buffer.insertOnly.push(createRecord);
          // Mark as completed for insert-only strategy
          this.buffer.completedSpans.add(spanKey);
          this.allCreatedSpans.add(spanKey);
        }
        break;
    }

    // Update total size
    this.buffer.totalSize = this.buffer.creates.length + this.buffer.updates.length + this.buffer.insertOnly.length;
  }

  /**
   * Checks if buffer should be flushed based on size or time triggers
   */
  private shouldFlush(): boolean {
    // Emergency flush - buffer overflow
    if (this.buffer.totalSize >= this.config.maxBufferSize) {
      return true;
    }

    // Size-based flush
    if (this.buffer.totalSize >= this.config.maxBatchSize) {
      return true;
    }

    // Time-based flush
    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.config.maxBatchWaitMs) {
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
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flush().catch(error => {
        this.logger.error('Scheduled flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.maxBatchWaitMs);
  }

  /**
   * Serializes span attributes to storage record format
   * Handles all AI span types and their specific attributes
   */
  private serializeAttributes(span: AnyExportedAISpan): Record<string, any> | null {
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

  private buildCreateRecord(span: AnyExportedAISpan): InternalAISpanRecord {
    return {
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      scope: null,
      spanType: span.type,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo,
      isEvent: span.isEvent,
    };
  }

  private buildUpdateRecord(span: AnyExportedAISpan): Partial<InternalAISpanRecord> {
    return {
      name: span.name,
      scope: null,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo,
    };
  }

  /**
   * Handles realtime strategy - processes each event immediately
   */
  private async handleRealtimeEvent(event: AITracingEvent, storage: MastraStorage): Promise<void> {
    const span = event.exportedSpan;
    const spanKey = this.buildSpanKey(span.traceId, span.id);

    // Event spans only have an end event
    if (span.isEvent) {
      if (event.type === AITracingEventType.SPAN_ENDED) {
        await storage.createAISpan({
          traceId: span.traceId,
          spanId: span.id,
          ...this.buildCreateRecord(span),
          createdAt: new Date(),
          updatedAt: null,
        });
        // For event spans in realtime, we don't need to track them since they're immediately complete
      } else {
        this.logger.warn(`Tracing event type not implemented for event spans: ${event.type}`);
      }
    } else {
      switch (event.type) {
        case AITracingEventType.SPAN_STARTED:
          await storage.createAISpan({
            traceId: span.traceId,
            spanId: span.id,
            ...this.buildCreateRecord(span),
            createdAt: new Date(),
            updatedAt: null,
          });
          // Track this span as created persistently
          this.allCreatedSpans.add(spanKey);
          break;
        case AITracingEventType.SPAN_UPDATED:
          await storage.updateAISpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: {
              ...this.buildUpdateRecord(span),
              updatedAt: new Date(),
            },
          });
          break;
        case AITracingEventType.SPAN_ENDED:
          await storage.updateAISpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: {
              ...this.buildUpdateRecord(span),
              updatedAt: new Date(),
            },
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
  private handleBatchWithUpdatesEvent(event: AITracingEvent): void {
    this.addToBuffer(event);

    if (this.shouldFlush()) {
      // Immediate flush for size/emergency triggers
      this.flush().catch(error => {
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
   * Handles insert-only strategy - only processes SPAN_ENDED events in batches
   */
  private handleInsertOnlyEvent(event: AITracingEvent): void {
    // Only process SPAN_ENDED events for insert-only strategy
    if (event.type === AITracingEventType.SPAN_ENDED) {
      this.addToBuffer(event);

      if (this.shouldFlush()) {
        // Immediate flush for size/emergency triggers
        this.flush().catch(error => {
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
    return this.config.retryDelayMs * Math.pow(2, attempt);
  }

  /**
   * Flushes the current buffer to storage with retry logic
   */
  private async flush(): Promise<void> {
    if (!this.mastra) {
      this.logger.debug('Cannot flush traces. Mastra instance not registered yet.');
      return;
    }

    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.debug('Cannot flush traces. Mastra storage is not initialized');
      return;
    }

    // Clear timer since we're flushing
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.totalSize === 0) {
      return; // Nothing to flush
    }

    const startTime = Date.now();
    const flushReason =
      this.buffer.totalSize >= this.config.maxBufferSize
        ? 'overflow'
        : this.buffer.totalSize >= this.config.maxBatchSize
          ? 'size'
          : 'time';

    // Create a copy of the buffer to work with
    const bufferCopy: BatchBuffer = {
      creates: [...this.buffer.creates],
      updates: [...this.buffer.updates],
      insertOnly: [...this.buffer.insertOnly],
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
    await this.flushWithRetries(storage, bufferCopy, 0);

    const elapsed = Date.now() - startTime;
    this.logger.debug('Batch flushed', {
      strategy: this.resolvedStrategy,
      batchSize: bufferCopy.totalSize,
      flushReason,
      durationMs: elapsed,
      outOfOrderCount: bufferCopy.outOfOrderCount > 0 ? bufferCopy.outOfOrderCount : undefined,
    });
  }

  /**
   * Attempts to flush with exponential backoff retry logic
   */
  private async flushWithRetries(storage: MastraStorage, buffer: BatchBuffer, attempt: number): Promise<void> {
    try {
      if (this.resolvedStrategy === 'batch-with-updates') {
        // Process creates first (always safe)
        if (buffer.creates.length > 0) {
          await storage.batchCreateAISpans({ records: buffer.creates });
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

          await storage.batchUpdateAISpans({ records: sortedUpdates });
        }
      } else if (this.resolvedStrategy === 'insert-only') {
        // Simple batch insert for insert-only strategy
        if (buffer.insertOnly.length > 0) {
          await storage.batchCreateAISpans({ records: buffer.insertOnly });
        }
      }

      // Success! Clean up completed spans from persistent tracking
      for (const spanKey of buffer.completedSpans) {
        this.allCreatedSpans.delete(spanKey);
      }
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        const retryDelay = this.calculateRetryDelay(attempt);
        this.logger.warn('Batch flush failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          nextRetryInMs: retryDelay,
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.flushWithRetries(storage, buffer, attempt + 1);
      } else {
        this.logger.error('Batch flush failed after all retries, dropping batch', {
          finalAttempt: attempt + 1,
          maxRetries: this.config.maxRetries,
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

  async exportEvent(event: AITracingEvent): Promise<void> {
    if (!this.mastra) {
      this.logger.debug('Cannot export AI tracing event. Mastra instance not registered yet.');
      return;
    }

    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.debug('Cannot store traces. Mastra storage is not initialized');
      return;
    }

    // Initialize strategy if not already done (fallback for edge cases)
    if (!this.strategyInitialized) {
      this.initializeStrategy(storage);
    }

    // Clear strategy routing - explicit and readable
    switch (this.resolvedStrategy) {
      case 'realtime':
        await this.handleRealtimeEvent(event, storage);
        break;
      case 'batch-with-updates':
        this.handleBatchWithUpdatesEvent(event);
        break;
      case 'insert-only':
        this.handleInsertOnlyEvent(event);
        break;
    }
  }

  async shutdown(): Promise<void> {
    // Clear any pending timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining events
    if (this.buffer.totalSize > 0) {
      this.logger.info('Flushing remaining events on shutdown', {
        remainingEvents: this.buffer.totalSize,
      });
      try {
        await this.flush();
      } catch (error) {
        this.logger.error('Failed to flush remaining events during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('DefaultExporter shutdown complete');
  }
}
