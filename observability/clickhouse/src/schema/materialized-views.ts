/**
 * Materialized views for efficient aggregation queries.
 */

import { TABLE_NAMES } from './tables.js';

/**
 * Hourly trace statistics per project/deployment
 */
export const TRACES_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_traces_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, status)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(start_time) AS hour,
  status,
  count() AS count,
  sum(duration_ms) AS total_duration_ms,
  avg(duration_ms) AS avg_duration_ms
FROM ${TABLE_NAMES.TRACES}
GROUP BY project_id, deployment_id, hour, status
`;

/**
 * Hourly span statistics per project/deployment
 */
export const SPANS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_spans_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, kind, status)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(start_time) AS hour,
  kind,
  status,
  count() AS count,
  sum(duration_ms) AS total_duration_ms,
  avg(duration_ms) AS avg_duration_ms
FROM ${TABLE_NAMES.SPANS}
GROUP BY project_id, deployment_id, hour, kind, status
`;

/**
 * Hourly log level counts per project/deployment
 */
export const LOGS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_logs_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, level)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(timestamp) AS hour,
  level,
  count() AS count
FROM ${TABLE_NAMES.LOGS}
GROUP BY project_id, deployment_id, hour, level
`;

/**
 * Hourly metric aggregations per project/deployment/metric name
 */
export const METRICS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_metrics_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, name, hour)
AS SELECT
  project_id,
  deployment_id,
  name,
  toStartOfHour(timestamp) AS hour,
  count() AS count,
  sum(value) AS sum_value,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value
FROM ${TABLE_NAMES.METRICS}
GROUP BY project_id, deployment_id, name, hour
`;

/**
 * Hourly score aggregations per project/deployment/score name
 */
export const SCORES_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_scores_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, name, hour)
AS SELECT
  project_id,
  deployment_id,
  name,
  toStartOfHour(timestamp) AS hour,
  count() AS count,
  sum(value) AS sum_value,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value
FROM ${TABLE_NAMES.SCORES}
GROUP BY project_id, deployment_id, name, hour
`;

/**
 * All materialized view creation SQL statements
 */
export const ALL_MATERIALIZED_VIEWS_SQL = [
  TRACES_HOURLY_STATS_VIEW_SQL,
  SPANS_HOURLY_STATS_VIEW_SQL,
  LOGS_HOURLY_STATS_VIEW_SQL,
  METRICS_HOURLY_STATS_VIEW_SQL,
  SCORES_HOURLY_STATS_VIEW_SQL,
];

/**
 * Materialized view names
 */
export const VIEW_NAMES = {
  TRACES_HOURLY: 'mastra_admin_traces_hourly_stats',
  SPANS_HOURLY: 'mastra_admin_spans_hourly_stats',
  LOGS_HOURLY: 'mastra_admin_logs_hourly_stats',
  METRICS_HOURLY: 'mastra_admin_metrics_hourly_stats',
  SCORES_HOURLY: 'mastra_admin_scores_hourly_stats',
} as const;
