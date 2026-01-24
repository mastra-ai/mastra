import { generateFilePath } from './file-naming.js';
import { serializeEventsToBuffer, estimateEventSize } from './serializer.js';

import type {
  ObservabilityEvent,
  ObservabilityEventType,
  EventBuffer,
  FlushResult,
  FlushError,
  FileStorageProvider,
} from './types.js';

/**
 * Configuration for the EventBatcher
 */
export interface EventBatcherConfig {
  fileStorage: FileStorageProvider;
  projectId: string;
  batchSize: number;
  flushIntervalMs: number;
  maxFileSize: number;
  basePath: string;
  debug: boolean;
  onFlush?: (result: FlushResult) => void;
}

/**
 * Event type to buffer mapping
 */
const EVENT_TYPES: ObservabilityEventType[] = ['trace', 'span', 'log', 'metric', 'score'];

/**
 * EventBatcher handles buffering and flushing of observability events.
 *
 * It maintains separate buffers for each event type and triggers flushes
 * based on:
 * - Batch size threshold
 * - Flush interval timeout
 * - Max file size threshold
 * - Manual flush() call
 * - Graceful shutdown
 */
export class EventBatcher {
  private buffers: Map<ObservabilityEventType, EventBuffer>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private isShutdown = false;
  private flushPromise: Promise<FlushResult> | null = null;

  // Statistics
  private totalEventsWritten = 0;
  private totalFilesWritten = 0;
  private lastFlushAt: Date | null = null;

  constructor(private readonly config: EventBatcherConfig) {
    this.buffers = new Map();
    this.initializeBuffers();
    this.startFlushTimer();
  }

  /**
   * Initialize empty buffers for each event type
   */
  private initializeBuffers(): void {
    for (const type of EVENT_TYPES) {
      this.buffers.set(type, {
        type,
        events: [],
        currentFileSize: 0,
        currentFilePath: null,
      });
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          if (this.config.debug) {
            console.error('[ObservabilityWriter] Flush timer error:', error);
          }
        });
      }, this.config.flushIntervalMs);

      // Unref the timer so it doesn't prevent process exit
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Add an event to the appropriate buffer
   */
  add(event: ObservabilityEvent): void {
    if (this.isShutdown) {
      throw new Error('Cannot add events after shutdown');
    }

    const buffer = this.buffers.get(event.type);
    if (!buffer) {
      throw new Error(`Unknown event type: ${event.type}`);
    }

    const eventSize = estimateEventSize(event);
    buffer.events.push(event);
    buffer.currentFileSize += eventSize;

    // Check if we should flush this buffer
    if (this.shouldFlushBuffer(buffer)) {
      // Trigger async flush (don't await)
      this.flushBuffer(buffer.type).catch(error => {
        if (this.config.debug) {
          console.error(`[ObservabilityWriter] Buffer flush error for ${buffer.type}:`, error);
        }
      });
    }
  }

  /**
   * Add multiple events
   */
  addMany(events: ObservabilityEvent[]): void {
    for (const event of events) {
      this.add(event);
    }
  }

  /**
   * Check if a buffer should be flushed
   */
  private shouldFlushBuffer(buffer: EventBuffer): boolean {
    // Flush if batch size exceeded
    if (buffer.events.length >= this.config.batchSize) {
      return true;
    }

    // Flush if file size exceeded
    if (buffer.currentFileSize >= this.config.maxFileSize) {
      return true;
    }

    return false;
  }

  /**
   * Flush a single buffer
   */
  private async flushBuffer(type: ObservabilityEventType): Promise<FlushResult> {
    const buffer = this.buffers.get(type);
    if (!buffer || buffer.events.length === 0) {
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    const events = buffer.events;
    const eventCount = events.length;

    // Reset buffer immediately to allow new events
    buffer.events = [];
    buffer.currentFileSize = 0;
    buffer.currentFilePath = null;

    try {
      const filePath = generateFilePath({
        basePath: this.config.basePath,
        type,
        projectId: this.config.projectId,
      });

      const content = serializeEventsToBuffer(events);
      await this.config.fileStorage.write(filePath, content);

      this.totalEventsWritten += eventCount;
      this.totalFilesWritten += 1;

      if (this.config.debug) {
        console.info(`[ObservabilityWriter] Wrote ${eventCount} ${type} events to ${filePath}`);
      }

      return { filesWritten: 1, eventsWritten: eventCount, errors: [] };
    } catch (error) {
      const flushError: FlushError = {
        type,
        error: error instanceof Error ? error : new Error(String(error)),
        eventCount,
      };

      if (this.config.debug) {
        console.error(`[ObservabilityWriter] Failed to flush ${type} buffer:`, error);
      }

      // Re-add events to buffer on failure (best effort)
      buffer.events.unshift(...events);
      buffer.currentFileSize += events.reduce((sum, e) => sum + estimateEventSize(e), 0);

      return { filesWritten: 0, eventsWritten: 0, errors: [flushError] };
    }
  }

  /**
   * Flush all buffers
   */
  async flush(): Promise<FlushResult> {
    // Prevent concurrent flushes
    if (this.isFlushing) {
      if (this.flushPromise) {
        return this.flushPromise;
      }
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    this.isFlushing = true;

    const flushOperation = async (): Promise<FlushResult> => {
      const results: FlushResult = {
        filesWritten: 0,
        eventsWritten: 0,
        errors: [],
      };

      // Flush all buffers in parallel
      const flushPromises = EVENT_TYPES.map(type => this.flushBuffer(type));
      const bufferResults = await Promise.all(flushPromises);

      for (const result of bufferResults) {
        results.filesWritten += result.filesWritten;
        results.eventsWritten += result.eventsWritten;
        results.errors.push(...result.errors);
      }

      this.lastFlushAt = new Date();

      if (this.config.onFlush) {
        this.config.onFlush(results);
      }

      return results;
    };

    this.flushPromise = flushOperation().finally(() => {
      this.isFlushing = false;
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  /**
   * Shutdown the batcher gracefully
   */
  async shutdown(): Promise<FlushResult> {
    if (this.isShutdown) {
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    this.isShutdown = true;
    this.stopFlushTimer();

    // Wait for any in-progress flush to complete
    if (this.flushPromise) {
      await this.flushPromise;
    }

    // Final flush of all remaining events
    return this.flush();
  }

  /**
   * Get current buffer statistics
   */
  getStats(): {
    totalEventsBuffered: number;
    totalEventsWritten: number;
    totalFilesWritten: number;
    lastFlushAt: Date | null;
    buffersByType: Record<string, { eventCount: number; estimatedSize: number }>;
  } {
    const buffersByType: Record<string, { eventCount: number; estimatedSize: number }> = {};
    let totalEventsBuffered = 0;

    for (const [type, buffer] of this.buffers) {
      buffersByType[type] = {
        eventCount: buffer.events.length,
        estimatedSize: buffer.currentFileSize,
      };
      totalEventsBuffered += buffer.events.length;
    }

    return {
      totalEventsBuffered,
      totalEventsWritten: this.totalEventsWritten,
      totalFilesWritten: this.totalFilesWritten,
      lastFlushAt: this.lastFlushAt,
      buffersByType,
    };
  }

  /**
   * Check if the batcher has been shutdown
   */
  isShutdownComplete(): boolean {
    return this.isShutdown;
  }
}
