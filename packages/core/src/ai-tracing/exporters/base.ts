/**
 * Base Exporter for AI Tracing
 *
 * Provides common functionality shared by all AI tracing exporters:
 * - Logger initialization with proper Mastra logger support
 * - Disabled state management
 * - Buffering and batching capabilities
 * - Graceful shutdown lifecycle
 */

import { ConsoleLogger, LogLevel } from '../../logger';
import type { IMastraLogger } from '../../logger';
import type { AITracingEvent, AITracingExporter } from '../types';

/**
 * Base configuration that all exporters should support
 */
export interface BaseExporterConfig {
  /** Optional Mastra logger instance */
  logger?: IMastraLogger;
  /** Log level for the exporter (defaults to INFO) */
  logLevel?: LogLevel;
}

/**
 * Configuration for buffered exporters
 */
export interface BufferedExporterConfig extends BaseExporterConfig {
  /** Maximum number of events to batch (default: 1000) */
  maxBatchSize?: number;
  /** Maximum time to wait before flushing in milliseconds (default: 5000ms) */
  maxBatchWaitMs?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Abstract base class for AI tracing exporters
 *
 * Handles common concerns:
 * - Logger setup with proper Mastra logger
 * - Disabled state management
 * - Basic lifecycle methods
 *
 * @example
 * ```typescript
 * class MyExporter extends BaseAITracingExporter {
 *   name = 'my-exporter';
 *
 *   constructor(config: MyExporterConfig) {
 *     super(config);
 *
 *     if (!config.apiKey) {
 *       this.setDisabled('Missing API key');
 *       return;
 *     }
 *
 *     // Initialize exporter-specific logic
 *   }
 *
 *   async exportEvent(event: AITracingEvent): Promise<void> {
 *     if (this.isDisabled) return;
 *     // Export logic
 *   }
 * }
 * ```
 */
export abstract class BaseAITracingExporter implements AITracingExporter {
  /** Exporter name - must be implemented by subclasses */
  abstract name: string;

  /** Mastra logger instance */
  protected logger: IMastraLogger;

  /** Whether this exporter is disabled */
  protected isDisabled: boolean = false;

  /**
   * Initialize the base exporter with logger
   */
  constructor(config: BaseExporterConfig = {}) {
    this.logger = config.logger ?? new ConsoleLogger({ level: config.logLevel ?? LogLevel.INFO });
  }

  /**
   * Mark the exporter as disabled and log a message
   *
   * @param reason - Reason why the exporter is disabled
   */
  protected setDisabled(reason: string): void {
    this.isDisabled = true;
    this.logger.debug(`${this.name} disabled: ${reason}`);
  }

  /**
   * Export a tracing event - must be implemented by subclasses
   */
  abstract exportEvent(event: AITracingEvent): Promise<void>;

  /**
   * Optional initialization hook called after Mastra is fully configured
   */
  init?(_config?: any): void;

  /**
   * Optional method to add scores to traces
   */
  addScoreToTrace?(_args: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void>;

  /**
   * Shutdown the exporter and clean up resources
   *
   * Default implementation just logs. Override to add custom cleanup.
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${this.name} shutdown complete`);
  }
}

/**
 * Abstract base class for buffered exporters that batch events
 *
 * Provides:
 * - Automatic batching based on size and time
 * - Flush scheduling and timer management
 * - Graceful shutdown with remaining event flush
 *
 * @example
 * ```typescript
 * class MyBufferedExporter extends BufferedAITracingExporter<MyEventType> {
 *   name = 'my-buffered-exporter';
 *
 *   constructor(config: MyExporterConfig) {
 *     super(config);
 *   }
 *
 *   async exportEvent(event: AITracingEvent): Promise<void> {
 *     if (this.isDisabled) return;
 *
 *     const myEvent = this.transformEvent(event);
 *     this.addToBuffer(myEvent);
 *
 *     if (this.shouldFlush()) {
 *       await this.flush();
 *     } else if (this.buffer.length === 1) {
 *       this.scheduleFlush();
 *     }
 *   }
 *
 *   protected async flushBuffer(events: MyEventType[]): Promise<void> {
 *     // Send events to external service
 *     await this.apiClient.send(events);
 *   }
 * }
 * ```
 */
export abstract class BufferedAITracingExporter<TBufferItem = any> extends BaseAITracingExporter {
  /** Buffer configuration */
  protected config: Required<BufferedExporterConfig>;

  /** Event buffer */
  protected buffer: TBufferItem[] = [];

  /** First event time for time-based flushing */
  protected firstEventTime?: Date;

  /** Flush timer handle */
  protected flushTimer: NodeJS.Timeout | null = null;

  constructor(config: BufferedExporterConfig = {}) {
    super(config);

    this.config = {
      logger: config.logger ?? new ConsoleLogger({ level: config.logLevel ?? LogLevel.INFO }),
      logLevel: config.logLevel ?? LogLevel.INFO,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * Add an item to the buffer
   */
  protected addToBuffer(item: TBufferItem): void {
    if (this.buffer.length === 0) {
      this.firstEventTime = new Date();
    }

    this.buffer.push(item);
  }

  /**
   * Check if buffer should be flushed
   *
   * Flushes when:
   * - Buffer size exceeds maxBatchSize
   * - Time since first event exceeds maxBatchWaitMs
   */
  protected shouldFlush(): boolean {
    // Size-based flush
    if (this.buffer.length >= this.config.maxBatchSize) {
      return true;
    }

    // Time-based flush
    if (this.firstEventTime && this.buffer.length > 0) {
      const elapsed = Date.now() - this.firstEventTime.getTime();
      if (elapsed >= this.config.maxBatchWaitMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Schedule a flush after maxBatchWaitMs
   */
  protected scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush().catch(error => {
        this.logger.error(`${this.name}: Scheduled flush failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.maxBatchWaitMs);
  }

  /**
   * Flush the buffer
   *
   * Clears timer, copies buffer, resets state, then calls flushBuffer()
   */
  protected async flush(): Promise<void> {
    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const startTime = Date.now();
    const bufferCopy = [...this.buffer];
    const flushReason = this.buffer.length >= this.config.maxBatchSize ? 'size' : 'time';

    // Reset buffer immediately
    this.resetBuffer();

    try {
      await this.flushBuffer(bufferCopy);

      const elapsed = Date.now() - startTime;
      this.logger.debug(`${this.name}: Batch flushed successfully`, {
        batchSize: bufferCopy.length,
        flushReason,
        durationMs: elapsed,
      });
    } catch (error) {
      this.logger.error(`${this.name}: Batch flush failed`, {
        error: error instanceof Error ? error.message : String(error),
        droppedEvents: bufferCopy.length,
      });
      // Don't re-throw - continue processing new events
    }
  }

  /**
   * Reset buffer state
   */
  protected resetBuffer(): void {
    this.buffer = [];
    this.firstEventTime = undefined;
  }

  /**
   * Flush buffer implementation - must be implemented by subclasses
   *
   * @param items - Buffered items to flush
   */
  protected abstract flushBuffer(items: TBufferItem[]): Promise<void>;

  /**
   * Shutdown with graceful buffer flush
   */
  async shutdown(): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    if (this.buffer.length > 0) {
      this.logger.info(`${this.name}: Flushing remaining events on shutdown`, {
        remainingEvents: this.buffer.length,
      });

      try {
        await this.flush();
      } catch (error) {
        this.logger.error(`${this.name}: Failed to flush remaining events during shutdown`, {
          error: error instanceof Error ? error.message : String(error),
          remainingEvents: this.buffer.length,
        });
      }
    }

    this.logger.info(`${this.name} shutdown complete`);
  }
}
