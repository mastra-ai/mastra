import type { FileStorageProvider } from '../file-storage/base';
import type { Log, Metric, ObservabilityEvent, Score, Span, Trace } from './types';

/**
 * Configuration for the ObservabilityWriter.
 */
export interface ObservabilityWriterConfig {
  /** File storage backend for writing JSONL files */
  fileStorage: FileStorageProvider;
  /** Number of events to batch before flushing (default: 1000) */
  batchSize?: number;
  /** Interval in ms to flush events (default: 5000) */
  flushIntervalMs?: number;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSize?: number;
}

/**
 * Abstract interface for writing observability events.
 * Events are batched and written to file storage as JSONL files.
 *
 * Implementation: ObservabilityWriter (observability/writer/)
 */
export interface ObservabilityWriterInterface {
  /**
   * Record a trace event.
   * Non-blocking - events are buffered internally.
   */
  recordTrace(trace: Trace): void;

  /**
   * Record a span event.
   * Non-blocking - events are buffered internally.
   */
  recordSpan(span: Span): void;

  /**
   * Record a log event.
   * Non-blocking - events are buffered internally.
   */
  recordLog(log: Log): void;

  /**
   * Record a metric event.
   * Non-blocking - events are buffered internally.
   */
  recordMetric(metric: Metric): void;

  /**
   * Record a score event.
   * Non-blocking - events are buffered internally.
   */
  recordScore(score: Score): void;

  /**
   * Record multiple events at once.
   * Non-blocking - events are buffered internally.
   */
  recordEvents(events: ObservabilityEvent[]): void;

  /**
   * Force flush all pending events to file storage.
   */
  flush(): Promise<void>;

  /**
   * Gracefully shutdown the writer.
   * Flushes all pending events before returning.
   */
  shutdown(): Promise<void>;
}
