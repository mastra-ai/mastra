/**
 * Buffered Exporter Base Class
 *
 * Provides common buffering and batching functionality for exporters that
 * accumulate events and flush them in batches based on size or time thresholds.
 *
 * Features:
 * - Configurable batch size and time-based flush triggers
 * - Automatic timer management for scheduled flushes
 * - Retry logic with exponential backoff
 * - Graceful shutdown with final flush
 *
 * Subclasses must implement:
 * - `processEvent()` - Transform and add event to buffer
 * - `sendBatch()` - Send accumulated records to the destination
 * - `getBufferSize()` - Return current buffer size
 * - `extractAndResetBuffer()` - Extract buffer contents and reset
 */

import type { TracingEvent } from '@mastra/core/observability';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';

export interface BufferedExporterConfig extends BaseExporterConfig {
  /** Maximum number of items before triggering a flush (default: 1000) */
  maxBatchSize?: number;
  /** Maximum time in ms to wait before flushing (default: 5000) */
  maxBatchWaitMs?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  retryDelayMs?: number;
}

export interface BufferedExporterState {
  /** Timestamp when the first item was added to the current buffer */
  firstEventTime?: Date;
  /** Total number of items in the buffer */
  totalSize: number;
}

/**
 * Abstract base class for exporters that buffer events and flush in batches.
 *
 * @typeParam TRecord - The type of record stored in the buffer
 * @typeParam TBuffer - The type of the buffer structure (defaults to TRecord[])
 */
export abstract class BufferedExporter<TRecord, TBuffer = TRecord[]> extends BaseExporter {
  // Configuration with defaults
  protected readonly maxBatchSize: number;
  protected readonly maxBatchWaitMs: number;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;

  // Buffer state
  protected bufferState: BufferedExporterState = {
    firstEventTime: undefined,
    totalSize: 0,
  };

  // Timer for scheduled flushes (protected for testing)
  protected flushTimer: NodeJS.Timeout | null = null;

  // Flag to prevent concurrent flushes
  private flushing = false;

  constructor(config: BufferedExporterConfig = {}) {
    super(config);

    this.maxBatchSize = config.maxBatchSize ?? 1000;
    this.maxBatchWaitMs = config.maxBatchWaitMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 500;
  }

  /**
   * Process an incoming tracing event.
   * Subclasses should transform the event and add it to their buffer.
   *
   * @param event - The tracing event to process
   * @returns true if the event was added to the buffer, false if it was skipped
   */
  protected abstract processEvent(event: TracingEvent): boolean | Promise<boolean>;

  /**
   * Send a batch of records to the destination.
   * Called during flush with the extracted buffer contents.
   *
   * @param buffer - The buffer contents to send
   */
  protected abstract sendBatch(buffer: TBuffer): Promise<void>;

  /**
   * Get the current size of the buffer.
   * Used to determine when to trigger size-based flushes.
   */
  protected abstract getBufferSize(): number;

  /**
   * Extract buffer contents and reset the buffer.
   * Called at the start of flush to get a snapshot of current data.
   *
   * @returns The current buffer contents
   */
  protected abstract extractAndResetBuffer(): TBuffer;

  /**
   * Called before the first item is added to an empty buffer.
   * Override to perform any setup needed when buffering starts.
   */
  protected onBufferStart(): void {
    this.bufferState.firstEventTime = new Date();
  }

  /**
   * Called after buffer is reset (after successful flush or on reset).
   * Override to perform any cleanup needed.
   */
  protected onBufferReset(): void {
    this.bufferState.firstEventTime = undefined;
    this.bufferState.totalSize = 0;
  }

  /**
   * Update the buffer size tracking.
   * Call this after adding items to the buffer.
   */
  protected updateBufferSize(size: number): void {
    this.bufferState.totalSize = size;
  }

  /**
   * Check if buffer should be flushed based on size threshold.
   */
  protected shouldFlushBySize(): boolean {
    return this.getBufferSize() >= this.maxBatchSize;
  }

  /**
   * Check if buffer should be flushed based on time threshold.
   */
  protected shouldFlushByTime(): boolean {
    if (!this.bufferState.firstEventTime || this.getBufferSize() === 0) {
      return false;
    }
    const elapsed = Date.now() - this.bufferState.firstEventTime.getTime();
    return elapsed >= this.maxBatchWaitMs;
  }

  /**
   * Check if buffer should be flushed (size or time based).
   * Override to add custom flush conditions.
   */
  protected shouldFlush(): boolean {
    return this.shouldFlushBySize() || this.shouldFlushByTime();
  }

  /**
   * Schedule a flush after maxBatchWaitMs.
   * Automatically manages timer - calling multiple times resets the timer.
   */
  protected scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flush().catch(error => {
        this.logger.error('Scheduled flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.maxBatchWaitMs);
  }

  /**
   * Cancel any scheduled flush.
   */
  protected cancelScheduledFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Calculate retry delay using exponential backoff.
   */
  protected calculateRetryDelay(attempt: number): number {
    return this.retryDelayMs * Math.pow(2, attempt);
  }

  /**
   * Flush the buffer to the destination with retry logic.
   */
  async flush(): Promise<void> {
    // Prevent concurrent flushes
    if (this.flushing) {
      return;
    }

    // Clear timer since we're flushing
    this.cancelScheduledFlush();

    const bufferSize = this.getBufferSize();
    if (bufferSize === 0) {
      return; // Nothing to flush
    }

    this.flushing = true;
    const startTime = Date.now();
    const flushReason = this.shouldFlushBySize() ? 'size' : 'time';

    // Extract buffer and reset immediately to prevent blocking new events
    const bufferSnapshot = this.extractAndResetBuffer();
    this.onBufferReset();

    try {
      await this.flushWithRetries(bufferSnapshot, 0);

      const elapsed = Date.now() - startTime;
      this.logger.debug('Batch flushed successfully', {
        batchSize: bufferSize,
        flushReason,
        durationMs: elapsed,
      });
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Attempt to flush with exponential backoff retry logic.
   */
  private async flushWithRetries(buffer: TBuffer, attempt: number): Promise<void> {
    try {
      await this.sendBatch(buffer);
    } catch (error) {
      if (attempt < this.maxRetries) {
        const retryDelay = this.calculateRetryDelay(attempt);
        this.logger.warn('Batch flush failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          nextRetryInMs: retryDelay,
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.flushWithRetries(buffer, attempt + 1);
      } else {
        this.logger.error('Batch flush failed after all retries, dropping batch', {
          finalAttempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't re-throw - allow processing to continue
      }
    }
  }

  /**
   * Handle incoming tracing event with automatic flush management.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const wasEmpty = this.getBufferSize() === 0;

    const added = await this.processEvent(event);
    if (!added) {
      return;
    }

    // Track buffer start time
    if (wasEmpty && this.getBufferSize() > 0) {
      this.onBufferStart();
    }

    // Check if we should flush
    if (this.shouldFlush()) {
      await this.flush();
    } else if (this.getBufferSize() === 1) {
      // Schedule flush for the first event in buffer
      this.scheduleFlush();
    }
  }

  /**
   * Shutdown the exporter, flushing any remaining events.
   */
  async shutdown(): Promise<void> {
    // Cancel any scheduled flush
    this.cancelScheduledFlush();

    // Flush any remaining events
    const bufferSize = this.getBufferSize();
    if (bufferSize > 0) {
      this.logger.info('Flushing remaining events on shutdown', {
        remainingEvents: bufferSize,
      });
      try {
        await this.flush();
      } catch (error) {
        this.logger.error('Failed to flush remaining events during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await super.shutdown();
  }
}
