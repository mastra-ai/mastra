/**
 * Raw DDL for Postgres v-next observability tables.
 *
 * One table per signal, mirroring the ClickHouse v-next layout:
 *   - mastra_span_events       (insert-only ended spans)
 *   - mastra_trace_roots       (root-span projection populated by a trigger)
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
export const TABLE_TRACE_ROOTS = 'mastra_trace_roots';
export const TABLE_METRIC_EVENTS = 'mastra_metric_events';
export const TABLE_LOG_EVENTS = 'mastra_log_events';
export const TABLE_SCORE_EVENTS = 'mastra_score_events';
export const TABLE_FEEDBACK_EVENTS = 'mastra_feedback_events';
export const TABLE_DISCOVERY = 'mastra_observability_discovery';

export const ALL_SIGNAL_TABLES = [
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_ROOTS,
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
] as const;

export const ALL_TABLE_NAMES = [...ALL_SIGNAL_TABLES, TABLE_DISCOVERY] as const;

/** Maps each signal table to the column used as its partition / TTL key. */
export const SIGNAL_TIME_COLUMN: Record<(typeof ALL_SIGNAL_TABLES)[number], string> = {
  [TABLE_SPAN_EVENTS]: 'endedAt',
  [TABLE_TRACE_ROOTS]: 'endedAt',
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
// Trace roots DDL — root span projection
// ---------------------------------------------------------------------------

function traceRootsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_TRACE_ROOTS)} (
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
  PRIMARY KEY ("traceId", "endedAt")
)
${partitionClause(mode, 'endedAt')}
`.trim();
}

/**
 * Trigger function + trigger that copies root-span inserts into trace_roots.
 * Postgres MATERIALIZED VIEW is non-incremental, so a row-level trigger is the
 * cheapest equivalent of the ClickHouse incremental MV.
 */
function traceRootsTriggerDDL(schema: string): string[] {
  const fnName = qualifiedName(schema, 'mastra_trace_roots_propagate');
  const triggerName = parseSqlIdentifier('mastra_trace_roots_after_insert', 'trigger name');
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const roots = qualifiedTable(schema, TABLE_TRACE_ROOTS);
  return [
    `
CREATE OR REPLACE FUNCTION ${fnName}() RETURNS trigger AS $$
BEGIN
  IF NEW."parentSpanId" IS NULL THEN
    INSERT INTO ${roots} (
      "traceId", "spanId", "parentSpanId", "experimentId",
      "entityType", "entityId", "entityName", "entityVersionId",
      "parentEntityType", "parentEntityId", "parentEntityName", "parentEntityVersionId",
      "rootEntityType", "rootEntityId", "rootEntityName", "rootEntityVersionId",
      "userId", "organizationId", "resourceId",
      "runId", "sessionId", "threadId", "requestId",
      "environment", "executionSource", "serviceName",
      "name", "spanType", "isEvent", "startedAt", "endedAt",
      "tags", "metadataSearch",
      "attributes", "scope", "links", "input", "output", "error", "metadataRaw", "requestContext"
    ) VALUES (
      NEW."traceId", NEW."spanId", NEW."parentSpanId", NEW."experimentId",
      NEW."entityType", NEW."entityId", NEW."entityName", NEW."entityVersionId",
      NEW."parentEntityType", NEW."parentEntityId", NEW."parentEntityName", NEW."parentEntityVersionId",
      NEW."rootEntityType", NEW."rootEntityId", NEW."rootEntityName", NEW."rootEntityVersionId",
      NEW."userId", NEW."organizationId", NEW."resourceId",
      NEW."runId", NEW."sessionId", NEW."threadId", NEW."requestId",
      NEW."environment", NEW."executionSource", NEW."serviceName",
      NEW."name", NEW."spanType", NEW."isEvent", NEW."startedAt", NEW."endedAt",
      NEW."tags", NEW."metadataSearch",
      NEW."attributes", NEW."scope", NEW."links", NEW."input", NEW."output", NEW."error", NEW."metadataRaw", NEW."requestContext"
    )
    ON CONFLICT ("traceId", "endedAt") DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`.trim(),
    `DROP TRIGGER IF EXISTS "${triggerName}" ON ${span}`,
    `CREATE TRIGGER "${triggerName}"
       AFTER INSERT ON ${span}
       FOR EACH ROW EXECUTE FUNCTION ${fnName}()`,
  ];
}

// ---------------------------------------------------------------------------
// Metric / log / score / feedback DDL
// ---------------------------------------------------------------------------

function metricEventsTableDDL(schema: string, mode: TableDDLMode): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(schema, TABLE_METRIC_EVENTS)} (
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
// Index definitions per table — partition-local btrees and GINs
// ---------------------------------------------------------------------------

interface IndexSpec {
  name: string;
  table: string;
  columns: string;
  using?: 'btree' | 'gin';
  where?: string;
}

function tableIndexes(): IndexSpec[] {
  return [
    // span_events
    { name: 'mastra_span_events_traceid_idx', table: TABLE_SPAN_EVENTS, columns: '("traceId", "endedAt" DESC)' },
    {
      name: 'mastra_span_events_parentspan_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("parentSpanId", "endedAt" DESC)',
    },
    { name: 'mastra_span_events_name_idx', table: TABLE_SPAN_EVENTS, columns: '("name")' },
    { name: 'mastra_span_events_spantype_idx', table: TABLE_SPAN_EVENTS, columns: '("spanType", "endedAt" DESC)' },
    {
      name: 'mastra_span_events_entity_idx',
      table: TABLE_SPAN_EVENTS,
      columns: '("entityType", "entityId")',
    },
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
    {
      name: 'mastra_span_events_tags_gin',
      table: TABLE_SPAN_EVENTS,
      columns: '("tags")',
      using: 'gin',
    },

    // trace_roots — same listTraces filter surface
    { name: 'mastra_trace_roots_startedat_idx', table: TABLE_TRACE_ROOTS, columns: '("startedAt" DESC)' },
    { name: 'mastra_trace_roots_spantype_idx', table: TABLE_TRACE_ROOTS, columns: '("spanType", "startedAt" DESC)' },
    { name: 'mastra_trace_roots_entity_idx', table: TABLE_TRACE_ROOTS, columns: '("entityType", "entityId")' },
    {
      name: 'mastra_trace_roots_entityname_idx',
      table: TABLE_TRACE_ROOTS,
      columns: '("entityType", "entityName")',
    },
    {
      name: 'mastra_trace_roots_orgid_userid_idx',
      table: TABLE_TRACE_ROOTS,
      columns: '("organizationId", "userId")',
    },
    {
      name: 'mastra_trace_roots_metadatasearch_gin',
      table: TABLE_TRACE_ROOTS,
      columns: '("metadataSearch" jsonb_path_ops)',
      using: 'gin',
    },
    { name: 'mastra_trace_roots_tags_gin', table: TABLE_TRACE_ROOTS, columns: '("tags")', using: 'gin' },

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

    // score_events
    {
      name: 'mastra_score_events_traceid_idx',
      table: TABLE_SCORE_EVENTS,
      columns: '("traceId", "timestamp" DESC)',
    },
    {
      name: 'mastra_score_events_scorerid_idx',
      table: TABLE_SCORE_EVENTS,
      columns: '("scorerId", "timestamp" DESC)',
    },
    {
      name: 'mastra_score_events_entity_idx',
      table: TABLE_SCORE_EVENTS,
      columns: '("entityType", "entityId", "timestamp" DESC)',
    },
    { name: 'mastra_score_events_tags_gin', table: TABLE_SCORE_EVENTS, columns: '("tags")', using: 'gin' },

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
    traceRootsTableDDL(schema, mode),
    metricEventsTableDDL(schema, mode),
    logEventsTableDDL(schema, mode),
    scoreEventsTableDDL(schema, mode),
    feedbackEventsTableDDL(schema, mode),
    discoveryTableDDL(schema),
  ];
}

/** Trigger DDL for trace_roots projection. Run after both span_events and trace_roots exist. */
export function triggerDDL(schema: string): string[] {
  return traceRootsTriggerDDL(schema);
}

/** Index CREATEs. Safe to run repeatedly. */
export function allIndexDDL(schema: string): string[] {
  return tableIndexes().map(spec => indexDDL(schema, spec));
}
