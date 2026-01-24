/**
 * ClickHouse table definitions for observability data.
 *
 * Uses MergeTree engine family for efficient time-series storage.
 * Tables are partitioned by month for efficient data management.
 */

/**
 * SQL for creating the traces table.
 * Traces represent complete request/operation lifecycles.
 */
export const TRACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_traces (
  -- Identity
  trace_id String,
  project_id String,
  deployment_id String,

  -- Trace info
  name String,
  status Enum8('ok' = 1, 'error' = 2, 'unset' = 0),

  -- Timing
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration_ms Nullable(Int64),

  -- Data
  input String DEFAULT '',
  output String DEFAULT '',
  metadata String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, deployment_id, start_time, trace_id)
TTL start_time + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the spans table.
 * Spans represent individual operations within a trace.
 */
export const SPANS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_spans (
  -- Identity
  span_id String,
  trace_id String,
  parent_span_id Nullable(String),
  project_id String,
  deployment_id String,

  -- Span info
  name String,
  kind Enum8('internal' = 0, 'server' = 1, 'client' = 2, 'producer' = 3, 'consumer' = 4),
  status Enum8('ok' = 1, 'error' = 2, 'unset' = 0),

  -- Timing
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration_ms Nullable(Int64),

  -- Data
  attributes String DEFAULT '{}',
  events String DEFAULT '[]',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, deployment_id, trace_id, span_id)
TTL start_time + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the logs table.
 * Logs capture textual information with severity levels.
 */
export const LOGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_logs (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Correlation
  trace_id Nullable(String),
  span_id Nullable(String),

  -- Log info
  level Enum8('debug' = 0, 'info' = 1, 'warn' = 2, 'error' = 3),
  message String,
  timestamp DateTime64(3),

  -- Data
  attributes String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, timestamp, id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the metrics table.
 * Metrics capture numeric measurements.
 */
export const METRICS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_metrics (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Metric info
  name String,
  type Enum8('counter' = 0, 'gauge' = 1, 'histogram' = 2),
  value Float64,
  unit Nullable(String),
  timestamp DateTime64(3),

  -- Labels (for grouping/filtering)
  labels String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, name, timestamp, id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the scores table.
 * Scores capture evaluation results.
 */
export const SCORES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_scores (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Correlation
  trace_id Nullable(String),

  -- Score info
  name String,
  value Float64,
  normalized_value Nullable(Float64),
  comment Nullable(String),
  timestamp DateTime64(3),

  -- Data
  metadata String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, name, timestamp, id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * All table creation SQL statements
 */
export const ALL_TABLES_SQL = [TRACES_TABLE_SQL, SPANS_TABLE_SQL, LOGS_TABLE_SQL, METRICS_TABLE_SQL, SCORES_TABLE_SQL];

/**
 * Table names
 */
export const TABLE_NAMES = {
  TRACES: 'mastra_admin_traces',
  SPANS: 'mastra_admin_spans',
  LOGS: 'mastra_admin_logs',
  METRICS: 'mastra_admin_metrics',
  SCORES: 'mastra_admin_scores',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
