/**
 * Types for @mastra/observability-writer
 *
 * Note: Core event types (Trace, Span, Log, Metric, Score) are defined in
 * @mastra/admin and re-exported here for convenience.
 */

import type {
  Trace,
  Span,
  SpanEvent,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  FileStorageProvider,
  FileInfo,
} from '@mastra/admin';

// Re-export types from @mastra/admin
export type { Trace, Span, SpanEvent, Log, Metric, Score, ObservabilityEvent };

export type { FileStorageProvider, FileInfo };

/**
 * Event type discriminator values.
 */
export type ObservabilityEventType = 'trace' | 'span' | 'log' | 'metric' | 'score';

/**
 * Configuration for the ObservabilityWriter.
 *
 * Extends the base config from @mastra/admin with additional options
 * specific to the writer implementation.
 */
export interface ObservabilityWriterConfig {
  /**
   * File storage provider for writing JSONL files.
   * Can be local filesystem, S3, GCS, etc.
   */
  fileStorage: FileStorageProvider;

  /**
   * Project ID for organizing files.
   * Files are written to: {basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
   */
  projectId: string;

  /**
   * Deployment ID for organizing files.
   * Used alongside projectId for file organization.
   */
  deploymentId: string;

  /**
   * Maximum number of events to buffer before flushing.
   * @default 1000
   */
  batchSize?: number;

  /**
   * Maximum time in milliseconds to wait before flushing buffered events.
   * @default 5000 (5 seconds)
   */
  flushIntervalMs?: number;

  /**
   * Maximum file size in bytes before rotating to a new file.
   * @default 10485760 (10MB)
   */
  maxFileSize?: number;

  /**
   * Base path for writing files.
   * @default 'observability'
   */
  basePath?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Internal buffer state for a specific event type.
 */
export interface EventBuffer {
  type: ObservabilityEventType;
  events: ObservabilityEvent[];
  currentFileSize: number;
  currentFilePath: string | null;
}

/**
 * Result of a flush operation.
 */
export interface FlushResult {
  filesWritten: number;
  eventsWritten: number;
  errors: FlushError[];
}

/**
 * Error that occurred during flush.
 */
export interface FlushError {
  type: ObservabilityEventType;
  error: Error;
  eventCount: number;
}

/**
 * Writer statistics for monitoring.
 */
export interface WriterStats {
  totalEventsBuffered: number;
  totalEventsWritten: number;
  totalFilesWritten: number;
  lastFlushAt: Date | null;
  buffersByType: Record<
    string,
    {
      eventCount: number;
      estimatedSize: number;
    }
  >;
}
