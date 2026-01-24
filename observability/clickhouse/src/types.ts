/**
 * Types for @mastra/observability-clickhouse
 */

import type { ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';
import type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  FileStorageProvider,
  FileInfo,
  ObservabilityQueryProvider,
} from '@mastra/admin';
import type { ObservabilityEventType } from '@mastra/observability-writer';

// Re-export types from @mastra/admin
export type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  FileStorageProvider,
  FileInfo,
  ObservabilityQueryProvider,
};

// Re-export ObservabilityEventType from @mastra/observability-writer
export type { ObservabilityEventType };

/**
 * ClickHouse connection configuration.
 * Accepts either a pre-configured client or connection credentials.
 */
export type ClickHouseConfig =
  | {
      /** Pre-configured ClickHouse client */
      client: ClickHouseClient;
    }
  | {
      /** ClickHouse server URL */
      url: string;
      /** ClickHouse username */
      username: string;
      /** ClickHouse password */
      password: string;
      /** Database name */
      database?: string;
      /** Additional client options */
      options?: Omit<ClickHouseClientConfigOptions, 'url' | 'username' | 'password' | 'database'>;
    };

/**
 * Configuration for the IngestionWorker
 */
export interface IngestionWorkerConfig {
  /**
   * File storage provider to read JSONL files from.
   */
  fileStorage: FileStorageProvider;

  /**
   * ClickHouse connection configuration.
   */
  clickhouse: ClickHouseConfig;

  /**
   * Interval in milliseconds between polling for new files.
   * @default 10000 (10 seconds)
   */
  pollIntervalMs?: number;

  /**
   * Maximum number of files to process in a single batch.
   * @default 10
   */
  batchSize?: number;

  /**
   * Maximum number of events to insert in a single ClickHouse batch.
   * @default 10000
   */
  insertBatchSize?: number;

  /**
   * Base path in file storage where observability files are stored.
   * @default 'observability'
   */
  basePath?: string;

  /**
   * Whether to delete files after processing instead of moving to processed/.
   * @default false
   */
  deleteAfterProcess?: boolean;

  /**
   * Number of retry attempts for failed operations.
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay in milliseconds between retry attempts.
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Project ID to filter files by (optional).
   * If not specified, processes files for all projects.
   */
  projectId?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Result of a single processing cycle
 */
export interface ProcessingResult {
  /** Number of files processed */
  filesProcessed: number;
  /** Number of events ingested into ClickHouse */
  eventsIngested: number;
  /** Breakdown by event type */
  eventsByType: Record<string, number>;
  /** Errors encountered during processing */
  errors: ProcessingError[];
  /** Duration of processing in milliseconds */
  durationMs: number;
}

/**
 * Error encountered during file processing
 */
export interface ProcessingError {
  /** File path that failed */
  filePath: string;
  /** Error message */
  message: string;
  /** Error details */
  error: Error;
  /** Retry count at time of failure */
  retryCount: number;
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  /** Whether the worker is currently running */
  isRunning: boolean;
  /** Whether the worker is currently processing files */
  isProcessing: boolean;
  /** Timestamp of last successful processing */
  lastProcessedAt: Date | null;
  /** Total files processed since worker started */
  totalFilesProcessed: number;
  /** Total events ingested since worker started */
  totalEventsIngested: number;
  /** Breakdown of total events by type */
  totalEventsByType: Record<string, number>;
  /** Current error count (resets on successful processing) */
  currentErrors: ProcessingError[];
  /** Worker start time */
  startedAt: Date | null;
}

/**
 * Configuration for ClickHouseQueryProvider
 */
export interface QueryProviderConfig {
  /**
   * ClickHouse connection configuration.
   */
  clickhouse: ClickHouseConfig;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Time range filter for queries
 */
export interface TimeRangeFilter {
  /** Start of time range (inclusive) */
  start?: Date;
  /** End of time range (inclusive) */
  end?: Date;
}

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  /** Page number (0-indexed) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
}

/**
 * Pagination info returned with list queries
 */
export interface PaginationInfo {
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Common filter options for observability queries
 */
export interface ObservabilityFilters {
  /** Filter by project ID */
  projectId?: string;
  /** Filter by deployment ID */
  deploymentId?: string;
  /** Filter by time range */
  timeRange?: TimeRangeFilter;
}

/**
 * Query options for traces
 */
export interface TraceQueryOptions extends ObservabilityFilters {
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by trace status */
  status?: 'ok' | 'error' | 'unset';
  /** Filter by trace name (partial match) */
  name?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for spans
 */
export interface SpanQueryOptions extends ObservabilityFilters {
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by span ID */
  spanId?: string;
  /** Filter by parent span ID */
  parentSpanId?: string;
  /** Filter by span kind */
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  /** Filter by span name (partial match) */
  name?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for logs
 */
export interface LogQueryOptions extends ObservabilityFilters {
  /** Filter by log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by span ID */
  spanId?: string;
  /** Filter by message content (partial match) */
  message?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for metrics
 */
export interface MetricQueryOptions extends ObservabilityFilters {
  /** Filter by metric name */
  name?: string;
  /** Filter by metric type */
  type?: 'counter' | 'gauge' | 'histogram';
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for scores
 */
export interface ScoreQueryOptions extends ObservabilityFilters {
  /** Filter by score name */
  name?: string;
  /** Filter by trace ID */
  traceId?: string;
  /** Minimum score value */
  minValue?: number;
  /** Maximum score value */
  maxValue?: number;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Aggregation bucket for time-series data
 */
export interface TimeBucket {
  /** Bucket start time */
  timestamp: Date;
  /** Count of items in bucket */
  count: number;
  /** Additional aggregated values */
  values?: Record<string, number>;
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Bucket interval in seconds */
  intervalSeconds: number;
  /** Time range for aggregation */
  timeRange: TimeRangeFilter;
  /** Group by fields */
  groupBy?: string[];
}
