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

// Schema
export {
  // Table definitions
  TRACES_TABLE_SQL,
  SPANS_TABLE_SQL,
  LOGS_TABLE_SQL,
  METRICS_TABLE_SQL,
  SCORES_TABLE_SQL,
  ALL_TABLES_SQL,
  TABLE_NAMES,

  // Materialized view definitions
  TRACES_HOURLY_STATS_VIEW_SQL,
  SPANS_HOURLY_STATS_VIEW_SQL,
  LOGS_HOURLY_STATS_VIEW_SQL,
  METRICS_HOURLY_STATS_VIEW_SQL,
  SCORES_HOURLY_STATS_VIEW_SQL,
  ALL_MATERIALIZED_VIEWS_SQL,
  VIEW_NAMES,

  // Migration utilities
  runMigrations,
  checkSchemaStatus,
  dropAllTables,
} from './schema/index.js';

export type { TableName } from './schema/index.js';

// Version
export const VERSION = '0.0.1';
