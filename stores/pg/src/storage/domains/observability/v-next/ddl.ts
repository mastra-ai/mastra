/**
 * Raw DDL for Postgres v-next observability tables.
 *
 * One table per signal:
 *   - mastra_span_events       (insert-only ended spans; root spans surfaced
 *                               via partial indexes, not a separate table)
 *   - mastra_metric_events
 *   - mastra_log_events
 *   - mastra_score_events
 *   - mastra_feedback_events
 *   - mastra_observability_discovery (cache table for discovery values)
 *
 * Physical conventions:
 *   - timestamptz for all timestamps (millisecond precision; Postgres native)
 *   - text + jsonb for IDs and payloads
 *   - text[] for `tags`, jsonb for `metadataSearch` / `labels`
 *   - Range partitioning by day on the time column (endedAt for spans, timestamp
 *     for others). Partition key is part of every primary key, as Postgres
 *     requires for partitioned tables.
 *   - Root-span lookups (the `listTraces` / `getRootSpan` read surface) are
 *     served by partial indexes on `mastra_span_events`
 *     (`WHERE "parentSpanId" IS NULL`). This is the Postgres-idiomatic
 *     equivalent of the ClickHouse `mastra_trace_roots` incremental MV:
 *     selective enough to act as a projection while avoiding the trigger,
 *     duplicate storage, and write amplification of a second table. The
 *     partial indexes are also chunk-local on a Timescale hypertable, so the
 *     same plan applies there.
 *   - Retention is intentionally NOT implemented in this domain; the partition
 *     skeleton exists so a future `mastra retention` CLI command can drop or
 *     compress old partitions. pg_partman is detected and used when available.
 *   - TimescaleDB is detected and create_hypertable() is called when the
 *     extension is present. The base DDL is identical either way.
 */

import { parseSqlIdentifier } from '@mastra/core/utils';

// ---------------------------------------------------------------------------
// Table names
// ---------------------------------------------------------------------------

export const TABLE_SPAN_EVENTS = 'mastra_span_events';
export const TABLE_METRIC_EVENTS = 'mastra_metric_events';
export const TABLE_LOG_EVENTS = 'mastra_log_events';
export const TABLE_SCORE_EVENTS = 'mastra_score_events';
export const TABLE_FEEDBACK_EVENTS = 'mastra_feedback_events';
export const TABLE_DISCOVERY = 'mastra_observability_discovery';

export const ALL_SIGNAL_TABLES = [
  TABLE_SPAN_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
] as const;

export const ALL_TABLE_NAMES = [...ALL_SIGNAL_TABLES, TABLE_DISCOVERY] as const;

/** Maps each signal table to the column used as its partition / TTL key. */
export const SIGNAL_TIME_COLUMN: Record<(typeof ALL_SIGNAL_TABLES)[number], string> = {
  [TABLE_SPAN_EVENTS]: 'endedAt',
  [TABLE_METRIC_EVENTS]: 'timestamp',
  [TABLE_LOG_EVENTS]: 'timestamp',
  [TABLE_SCORE_EVENTS]: 'timestamp',
  [TABLE_FEEDBACK_EVENTS]: 'timestamp',
};

// ---------------------------------------------------------------------------
// Schema-aware identifier helpers
// ---------------------------------------------------------------------------

/** Returns a fully-qualified, double-quoted table name. */
export function qualifiedTable(schema: string, table: string): string {
  const s = parseSqlIdentifier(schema, 'schema name');
  const t = parseSqlIdentifier(table, 'table name');
  return `"${s}"."${t}"`;
}

/** Returns a parsed, quoted, schema-prefixed object name (constraint, index, etc.). */
export function qualifiedName(schema: string, name: string): string {
  const s = parseSqlIdentifier(schema, 'schema name');
  const n = parseSqlIdentifier(name, 'object name');
  return `"${s}"."${n}"`;
}

// ---------------------------------------------------------------------------
// Mode-aware partitioning clause
// ---------------------------------------------------------------------------

/**
 * Postgres declarative partitioning and Timescale hypertables are mutually
 * exclusive. When running on Timescale, the base table must NOT be declared
 * `PARTITION BY` — `create_hypertable()` handles chunking internally. For
 * native and pg_partman modes we keep `PARTITION BY RANGE` so future
 * partitions can be created with `CREATE TABLE ... PARTITION OF`.
 */
function partitionClause(mode: TableDDLMode, column: string): string {
  return mode === 'timescale' ? '' : `PARTITION BY RANGE ("${column}")`;
}

export type TableDDLMode = 'timescale' | 'partitioned';

// ---------------------------------------------------------------------------
// Span events DDL — completed spans, insert-only
// ---------------------------------------------------------------------------

function spanEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_SPAN_EVENTS)} (
  "cursorId"              bigserial NOT NULL,
  "traceId"               text NOT NULL,
  "spanId"                text NOT NULL,
  "parentSpanId"          text,
  "experimentId"          text,
  "entityType"            text,
  "entityId"              text,
  "entityName"            text,
  "entityVersionId"       text,
  "parentEntityType"      text,
  "parentEntityId"        text,
  "parentEntityName"      text,
  "parentEntityVersionId" text,
  "rootEntityType"        text,
  "rootEntityId"          text,
  "rootEntityName"        text,
  "rootEntityVersionId"   text,
  "userId"                text,
  "organizationId"        text,
  "resourceId"            text,
  "runId"                 text,
  "sessionId"             text,
  "threadId"              text,
  "requestId"             text,
  "environment"           text,
  "executionSource"       text,
  "serviceName"           text,
  "name"                  text NOT NULL,
  "spanType"              text NOT NULL,
  "isEvent"               boolean NOT NULL DEFAULT false,
  "startedAt"             timestamptz NOT NULL,
  "endedAt"               timestamptz NOT NULL,
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "metadataSearch"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "attributes"            jsonb,
  "scope"                 jsonb,
  "links"                 jsonb,
  "input"                 jsonb,
  "output"                jsonb,
  "error"                 jsonb,
  "metadataRaw"           jsonb,
  "requestContext"        jsonb,
  PRIMARY KEY ("traceId", "spanId", "endedAt")
)
${partitionClause(mode, 'endedAt')}
`.trim();
}

// ---------------------------------------------------------------------------
// Metric / log / score / feedback DDL
// ---------------------------------------------------------------------------

function metricEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_METRIC_EVENTS)} (
  "cursorId"              bigserial NOT NULL,
  "metricId"              text NOT NULL,
  "timestamp"             timestamptz NOT NULL,
  "name"                  text NOT NULL,
  "value"                 double precision NOT NULL,
  "traceId"               text,
  "spanId"                text,
  "experimentId"          text,
  "entityType"            text,
  "entityId"              text,
  "entityName"            text,
  "entityVersionId"       text,
  "parentEntityType"      text,
  "parentEntityId"        text,
  "parentEntityName"      text,
  "parentEntityVersionId" text,
  "rootEntityType"        text,
  "rootEntityId"          text,
  "rootEntityName"        text,
  "rootEntityVersionId"   text,
  "userId"                text,
  "organizationId"        text,
  "resourceId"            text,
  "runId"                 text,
  "sessionId"             text,
  "threadId"              text,
  "requestId"             text,
  "environment"           text,
  "executionSource"       text,
  "serviceName"           text,
  "provider"              text,
  "model"                 text,
  "estimatedCost"         double precision,
  "costUnit"              text,
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "labels"                jsonb NOT NULL DEFAULT '{}'::jsonb,
  "costMetadata"          jsonb,
  "metadata"              jsonb,
  "scope"                 jsonb,
  PRIMARY KEY ("metricId", "timestamp")
)
${partitionClause(mode, 'timestamp')}
`.trim();
}

function logEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_LOG_EVENTS)} (
  "cursorId"              bigserial NOT NULL,
  "logId"                 text NOT NULL,
  "timestamp"             timestamptz NOT NULL,
  "level"                 text NOT NULL,
  "message"               text NOT NULL,
  "traceId"               text,
  "spanId"                text,
  "experimentId"          text,
  "entityType"            text,
  "entityId"              text,
  "entityName"            text,
  "entityVersionId"       text,
  "parentEntityType"      text,
  "parentEntityId"        text,
  "parentEntityName"      text,
  "parentEntityVersionId" text,
  "rootEntityType"        text,
  "rootEntityId"          text,
  "rootEntityName"        text,
  "rootEntityVersionId"   text,
  "userId"                text,
  "organizationId"        text,
  "resourceId"            text,
  "runId"                 text,
  "sessionId"             text,
  "threadId"              text,
  "requestId"             text,
  "environment"           text,
  "executionSource"       text,
  "serviceName"           text,
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "data"                  jsonb,
  "metadata"              jsonb,
  "scope"                 jsonb,
  PRIMARY KEY ("logId", "timestamp")
)
${partitionClause(mode, 'timestamp')}
`.trim();
}

function scoreEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_SCORE_EVENTS)} (
  "cursorId"              bigserial NOT NULL,
  "scoreId"               text NOT NULL,
  "timestamp"             timestamptz NOT NULL,
  "scorerId"              text NOT NULL,
  "scorerVersion"         text,
  "scoreSource"           text,
  "score"                 double precision NOT NULL,
  "reason"                text,
  "traceId"               text,
  "spanId"                text,
  "experimentId"          text,
  "scoreTraceId"          text,
  "entityType"            text,
  "entityId"              text,
  "entityName"            text,
  "entityVersionId"       text,
  "parentEntityType"      text,
  "parentEntityId"        text,
  "parentEntityName"      text,
  "parentEntityVersionId" text,
  "rootEntityType"        text,
  "rootEntityId"          text,
  "rootEntityName"        text,
  "rootEntityVersionId"   text,
  "userId"                text,
  "organizationId"        text,
  "resourceId"            text,
  "runId"                 text,
  "sessionId"             text,
  "threadId"              text,
  "requestId"             text,
  "environment"           text,
  "executionSource"       text,
  "serviceName"           text,
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "metadata"              jsonb,
  "scope"                 jsonb,
  PRIMARY KEY ("scoreId", "timestamp")
)
${partitionClause(mode, 'timestamp')}
`.trim();
}

function feedbackEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)} (
  "cursorId"              bigserial NOT NULL,
  "feedbackId"            text NOT NULL,
  "timestamp"             timestamptz NOT NULL,
  "feedbackSource"        text NOT NULL,
  "feedbackType"          text NOT NULL,
  "valueString"           text,
  "valueNumber"           double precision,
  "comment"               text,
  "feedbackUserId"        text,
  "sourceId"              text,
  "traceId"               text,
  "spanId"                text,
  "experimentId"          text,
  "entityType"            text,
  "entityId"              text,
  "entityName"            text,
  "entityVersionId"       text,
  "parentEntityType"      text,
  "parentEntityId"        text,
  "parentEntityName"      text,
  "parentEntityVersionId" text,
  "rootEntityType"        text,
  "rootEntityId"          text,
  "rootEntityName"        text,
  "rootEntityVersionId"   text,
  "userId"                text,
  "organizationId"        text,
  "resourceId"            text,
  "runId"                 text,
  "sessionId"             text,
  "threadId"              text,
  "requestId"             text,
  "environment"           text,
  "executionSource"       text,
  "serviceName"           text,
  "tags"                  text[] NOT NULL DEFAULT '{}',
  "metadata"              jsonb,
  "scope"                 jsonb,
  PRIMARY KEY ("feedbackId", "timestamp")
)
${partitionClause(mode, 'timestamp')}
`.trim();
}

// ---------------------------------------------------------------------------
// Discovery cache table — refreshed lazily by readers
// ---------------------------------------------------------------------------

function discoveryTableDDL(schema: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_DISCOVERY)} (
  "cacheKey"              text PRIMARY KEY,
  "refreshedAt"           timestamptz NOT NULL,
  "values"                jsonb NOT NULL DEFAULT '[]'::jsonb
)
`.trim();
}

// ---------------------------------------------------------------------------
// Index definitions per table — partition-local btrees, GINs, and partial
// indexes that act as a root-span projection on span_events.
// ---------------------------------------------------------------------------

interface IndexSpec {
  name: string;
  table: string;
  columns: string;
  using?: 'btree' | 'gin';
  where?: string;
}

/**
 * Filter that selects only root spans. Used to make several span_events
 * indexes act as a projection for the `listTraces` / `getRootSpan` read path.
 */
const ROOT_SPAN_WHERE = '"parentSpanId" IS NULL';

function tableIndexes(): IndexSpec[] {
  return [
    // span_events — full-table indexes used by getTrace / getSpan
    { name: 'mastra_span_events_traceid_idx', table: TABLE_SPAN_EVENTS, columns: '("traceId", "endedAt" DESC)' },
    {
      name: 'mastra_span_events_parentspan_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("parentSpanId", "endedAt" DESC)',
    },
    { name: 'mastra_span_events_name_idx', table: TABLE_SPAN_EVENTS, columns: '("name")' },
    // Used by listBranches page mode (filter by spanType, order by startedAt).
    { name: 'mastra_span_events_spantype_idx', table: TABLE_SPAN_EVENTS, columns: '("spanType", "startedAt" DESC)' },
    { name: 'mastra_span_events_entity_idx', table: TABLE_SPAN_EVENTS, columns: '("entityType", "entityId")' },
    {
      name: 'mastra_span_events_orgid_userid_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("organizationId", "userId")',
    },
    {
      name: 'mastra_span_events_metadatasearch_gin',
      table: TABLE_SPAN_EVENTS,
      columns: '("metadataSearch" jsonb_path_ops)',
      using: 'gin',
    },
    { name: 'mastra_span_events_tags_gin', table: TABLE_SPAN_EVENTS, columns: '("tags")', using: 'gin' },

    // span_events — partial indexes acting as the root-span projection. The
    // listTraces filter surface (startedAt / spanType / entityType / etc.) is
    // covered by these; rows where parentSpanId IS NOT NULL are excluded from
    // the index, so the index is the size of a separate trace_roots table.
    {
      name: 'mastra_span_events_root_startedat_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("startedAt" DESC)',
      where: ROOT_SPAN_WHERE,
    },
    {
      name: 'mastra_span_events_root_endedat_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("endedAt" DESC)',
      where: ROOT_SPAN_WHERE,
    },
    {
      name: 'mastra_span_events_root_spantype_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("spanType", "startedAt" DESC)',
      where: ROOT_SPAN_WHERE,
    },
    {
      name: 'mastra_span_events_root_entityname_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("entityType", "entityName", "startedAt" DESC)',
      where: ROOT_SPAN_WHERE,
    },
    {
      name: 'mastra_span_events_root_traceid_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("traceId")',
      where: ROOT_SPAN_WHERE,
    },
    // Delta polling: cursor ordering. Full-table coverage so the same index
    // serves both listTraces (combined with the `parentSpanId IS NULL`
    // predicate) and listBranches (combined with `spanType IN (...)`).
    {
      name: 'mastra_span_events_cursor_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("cursorId")',
    },

    // metric_events
    { name: 'mastra_metric_events_name_ts_idx', table: TABLE_METRIC_EVENTS, columns: '("name", "timestamp" DESC)' },
    {
      name: 'mastra_metric_events_entity_idx',
      table: TABLE_METRIC_EVENTS,
      columns: '("entityType", "entityId", "timestamp" DESC)',
    },
    { name: 'mastra_metric_events_traceid_idx', table: TABLE_METRIC_EVENTS, columns: '("traceId")' },
    { name: 'mastra_metric_events_labels_gin', table: TABLE_METRIC_EVENTS, columns: '("labels")', using: 'gin' },
    { name: 'mastra_metric_events_tags_gin', table: TABLE_METRIC_EVENTS, columns: '("tags")', using: 'gin' },
    { name: 'mastra_metric_events_cursor_idx', table: TABLE_METRIC_EVENTS, columns: '("cursorId")' },

    // log_events
    { name: 'mastra_log_events_ts_idx', table: TABLE_LOG_EVENTS, columns: '("timestamp" DESC)' },
    { name: 'mastra_log_events_level_ts_idx', table: TABLE_LOG_EVENTS, columns: '("level", "timestamp" DESC)' },
    { name: 'mastra_log_events_traceid_idx', table: TABLE_LOG_EVENTS, columns: '("traceId")' },
    {
      name: 'mastra_log_events_entity_idx',
      table: TABLE_LOG_EVENTS,
      columns: '("entityType", "entityId", "timestamp" DESC)',
    },
    { name: 'mastra_log_events_tags_gin', table: TABLE_LOG_EVENTS, columns: '("tags")', using: 'gin' },
    { name: 'mastra_log_events_cursor_idx', table: TABLE_LOG_EVENTS, columns: '("cursorId")' },

    // score_events
    { name: 'mastra_score_events_traceid_idx', table: TABLE_SCORE_EVENTS, columns: '("traceId", "timestamp" DESC)' },
    { name: 'mastra_score_events_scorerid_idx', table: TABLE_SCORE_EVENTS, columns: '("scorerId", "timestamp" DESC)' },
    {
      name: 'mastra_score_events_entity_idx',
      table: TABLE_SCORE_EVENTS,
      columns: '("entityType", "entityId", "timestamp" DESC)',
    },
    { name: 'mastra_score_events_tags_gin', table: TABLE_SCORE_EVENTS, columns: '("tags")', using: 'gin' },
    { name: 'mastra_score_events_cursor_idx', table: TABLE_SCORE_EVENTS, columns: '("cursorId")' },

    // feedback_events
    {
      name: 'mastra_feedback_events_traceid_idx',
      table: TABLE_FEEDBACK_EVENTS,
      columns: '("traceId", "timestamp" DESC)',
    },
    {
      name: 'mastra_feedback_events_type_idx',
      table: TABLE_FEEDBACK_EVENTS,
      columns: '("feedbackType", "timestamp" DESC)',
    },
    {
      name: 'mastra_feedback_events_entity_idx',
      table: TABLE_FEEDBACK_EVENTS,
      columns: '("entityType", "entityId", "timestamp" DESC)',
    },
    { name: 'mastra_feedback_events_tags_gin', table: TABLE_FEEDBACK_EVENTS, columns: '("tags")', using: 'gin' },
    { name: 'mastra_feedback_events_cursor_idx', table: TABLE_FEEDBACK_EVENTS, columns: '("cursorId")' },
  ];
}

function indexDDL(schema: string, spec: IndexSpec): string {
  const idxName = parseSqlIdentifier(spec.name, 'index name');
  const using = spec.using ? `USING ${spec.using}` : '';
  const where = spec.where ? `WHERE ${spec.where}` : '';
  return `CREATE INDEX IF NOT EXISTS "${idxName}" ON ${qualifiedTable(schema, spec.table)} ${using} ${spec.columns} ${where}`.replace(
    /\s+/g,
    ' ',
  );
}

// ---------------------------------------------------------------------------
// Public DDL accessors
// ---------------------------------------------------------------------------

/** All table CREATEs in dependency-safe order. */
export function allTableDDL(schema: string, mode: TableDDLMode): string[] {
  return [
    spanEventsTableDDL(schema, mode),
    metricEventsTableDDL(schema, mode),
    logEventsTableDDL(schema, mode),
    scoreEventsTableDDL(schema, mode),
    feedbackEventsTableDDL(schema, mode),
    discoveryTableDDL(schema),
  ];
}

/** Index CREATEs. Safe to run repeatedly. */
export function allIndexDDL(schema: string): string[] {
  return tableIndexes().map(spec => indexDDL(schema, spec));
}
