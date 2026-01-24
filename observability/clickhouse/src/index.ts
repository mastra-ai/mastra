/**
 * @mastra/observability-clickhouse
 *
 * ClickHouse storage and ingestion worker for MastraAdmin observability data.
 * Provides schema management, query capabilities, and an ingestion worker
 * for processing JSONL observability files into ClickHouse.
 *
 * @packageDocumentation
 */

// Types
export type {
  // Re-exported from @mastra/admin
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  FileStorageProvider,
  FileInfo,
  ObservabilityQueryProvider,

  // Re-exported from @mastra/observability-writer
  ObservabilityEventType,

  // ClickHouse configuration
  ClickHouseConfig,

  // Ingestion worker types
  IngestionWorkerConfig,
  ProcessingResult,
  ProcessingError,
  WorkerStatus,

  // Query provider types
  QueryProviderConfig,
  TimeRangeFilter,
  PaginationOptions,
  PaginationInfo,
  ObservabilityFilters,
  TraceQueryOptions,
  SpanQueryOptions,
  LogQueryOptions,
  MetricQueryOptions,
  ScoreQueryOptions,
  TimeBucket,
  AggregationOptions,
} from './types.js';

// Version
export const VERSION = '0.0.1';
