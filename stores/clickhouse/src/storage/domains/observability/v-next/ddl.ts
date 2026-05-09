/**
 * Raw DDL for ClickHouse v-next observability tables.
 *
 * Column ordering convention:
 *   1. Identity (dedupeKey for tracing)
 *   2. IDs (trace, span, experiment)
 *   3. Entity hierarchy (entity, parent, root)
 *   4. Context (user, org, resource, run, session, thread, request, environment, executionSource, serviceName)
 *   5. Span / domain-specific scalars
 *   6. Query-relevant flexible fields (tags, labels, metadataSearch)
 *   7. Information-only JSON payloads
 *
 * Physical conventions:
 *   - DateTime64(3, 'UTC') for all timestamps
 *   - String for required IDs, Nullable(String) for optional IDs
 *   - LowCardinality for low-cardinality dimensions
 *   - Array(LowCardinality(String)) DEFAULT [] for tags
 *   - Map(LowCardinality(String), String) DEFAULT {} for labels / metadataSearch
 *   - Nullable(String) for JSON-encoded payloads
 *   - No physical createdAt/updatedAt columns
 */

// ---------------------------------------------------------------------------
// Table names
// ---------------------------------------------------------------------------

export const TABLE_SPAN_EVENTS = 'mastra_span_events';
export const TABLE_TRACE_ROOTS = 'mastra_trace_roots';
export const TABLE_TRACE_BRANCHES = 'mastra_trace_branches';
export const TABLE_METRIC_EVENTS = 'mastra_metric_events';
export const TABLE_LOG_EVENTS = 'mastra_log_events';
export const TABLE_SCORE_EVENTS = 'mastra_score_events';
export const TABLE_FEEDBACK_EVENTS = 'mastra_feedback_events';
export const TABLE_DISCOVERY_VALUES = 'mastra_discovery_values';
export const TABLE_DISCOVERY_PAIRS = 'mastra_discovery_pairs';

// ---------------------------------------------------------------------------
// MV names
// ---------------------------------------------------------------------------

export const MV_TRACE_ROOTS = 'mastra_mv_trace_roots';
export const MV_TRACE_BRANCHES = 'mastra_mv_trace_branches';
export const MV_DISCOVERY_VALUES = 'mastra_mv_discovery_values';
export const MV_DISCOVERY_PAIRS = 'mastra_mv_discovery_pairs';

/**
 * Span types that anchor a listable trace branch -- a named entity got
 * invoked. Materialized into `mastra_trace_branches` so they're listable
 * independently of where they appear in a trace tree.
 *
 * Kept as a literal SQL list (not derived from {@link BRANCH_SPAN_TYPES})
 * so the MV definition is hermetic and doesn't trigger re-creation if a
 * future enum re-order changes the value source.
 */
export const BRANCH_SPAN_TYPE_VALUES = [
  'agent_run',
  'workflow_run',
  'processor_run',
  'scorer_run',
  'rag_ingestion',
  'tool_call',
  'mcp_tool_call',
] as const;

// ---------------------------------------------------------------------------
// span_events — completed spans, ReplacingMergeTree (dedupeKey)
// ---------------------------------------------------------------------------

export const SPAN_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_SPAN_EVENTS} (
  -- Identity
  dedupeKey          String,

  -- IDs
  traceId            String,
  spanId             String,
  parentSpanId       Nullable(String),
  experimentId       Nullable(String),

  -- Entity
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),

  -- Parent entity
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),

  -- Root entity
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Span scalars
  name               String,
  spanType           LowCardinality(String),
  isEvent            Bool DEFAULT false,
  startedAt          DateTime64(3, 'UTC'),
  endedAt            DateTime64(3, 'UTC'),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],
  metadataSearch     Map(LowCardinality(String), String) DEFAULT map(),

  -- Information-only JSON payloads
  attributes         Nullable(String),
  scope              Nullable(String),
  links              Nullable(String),
  input              Nullable(String),
  output             Nullable(String),
  error              Nullable(String),
  metadataRaw        Nullable(String),
  requestContext     Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(endedAt)
ORDER BY (traceId, endedAt, spanId, dedupeKey)
`;

// ---------------------------------------------------------------------------
// trace_roots — root spans only, populated by incremental MV
// ---------------------------------------------------------------------------

export const TRACE_ROOTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_TRACE_ROOTS} (
  -- Identity
  dedupeKey          String,

  -- IDs
  traceId            String,
  spanId             String,
  parentSpanId       Nullable(String),
  experimentId       Nullable(String),

  -- Entity
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),

  -- Parent entity
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),

  -- Root entity
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Span scalars
  name               String,
  spanType           LowCardinality(String),
  isEvent            Bool DEFAULT false,
  startedAt          DateTime64(3, 'UTC'),
  endedAt            DateTime64(3, 'UTC'),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],
  metadataSearch     Map(LowCardinality(String), String) DEFAULT map(),

  -- Information-only JSON payloads
  attributes         Nullable(String),
  scope              Nullable(String),
  links              Nullable(String),
  input              Nullable(String),
  output             Nullable(String),
  error              Nullable(String),
  metadataRaw        Nullable(String),
  requestContext     Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(endedAt)
ORDER BY (startedAt, traceId, dedupeKey)
`;

// ---------------------------------------------------------------------------
// MV: span_events → trace_roots (root spans only, incremental)
// ---------------------------------------------------------------------------

export const TRACE_ROOTS_MV_DDL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${MV_TRACE_ROOTS}
TO ${TABLE_TRACE_ROOTS}
AS
SELECT *
FROM ${TABLE_SPAN_EVENTS}
WHERE parentSpanId IS NULL
`;

// ---------------------------------------------------------------------------
// trace_branches — anchor spans of every named-entity invocation across the
//                  tree, ReplacingMergeTree
//
// Same column shape as span_events / trace_roots (the MV does SELECT *), so a
// row can flow trace_roots ← span_events → trace_branches without
// column-by-column projection. Differs in ORDER BY: this table is
// filter-by-spanType-first to support "all branches anchored at entity X"
// listings independent of trace identity. Pairs with getBranch() to expand a
// single anchor into its subtree.
// ---------------------------------------------------------------------------

export const TRACE_BRANCHES_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_TRACE_BRANCHES} (
  -- Identity
  dedupeKey          String,

  -- IDs
  traceId            String,
  spanId             String,
  parentSpanId       Nullable(String),
  experimentId       Nullable(String),

  -- Entity
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),

  -- Parent entity
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),

  -- Root entity
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Span scalars
  name               String,
  spanType           LowCardinality(String),
  isEvent            Bool DEFAULT false,
  startedAt          DateTime64(3, 'UTC'),
  endedAt            DateTime64(3, 'UTC'),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],
  metadataSearch     Map(LowCardinality(String), String) DEFAULT map(),

  -- Information-only JSON payloads
  attributes         Nullable(String),
  scope              Nullable(String),
  links              Nullable(String),
  input              Nullable(String),
  output             Nullable(String),
  error              Nullable(String),
  metadataRaw        Nullable(String),
  requestContext     Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(endedAt)
ORDER BY (spanType, startedAt, traceId, dedupeKey)
`;

// ---------------------------------------------------------------------------
// MV: span_events → trace_branches (only branch-anchor span types, incremental)
// ---------------------------------------------------------------------------

export const TRACE_BRANCHES_MV_DDL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${MV_TRACE_BRANCHES}
TO ${TABLE_TRACE_BRANCHES}
AS
SELECT *
FROM ${TABLE_SPAN_EVENTS}
WHERE spanType IN (${BRANCH_SPAN_TYPE_VALUES.map(v => `'${v}'`).join(', ')})
`;

// ---------------------------------------------------------------------------
// metric_events — ReplacingMergeTree with metricId dedup
// ---------------------------------------------------------------------------

export const METRIC_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_METRIC_EVENTS} (
  -- Timestamp
  timestamp          DateTime64(3, 'UTC'),

  -- IDs
  metricId           String,
  traceId            Nullable(String),
  spanId             Nullable(String),
  experimentId       Nullable(String),

  -- Entity hierarchy
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Metric scalars
  name               LowCardinality(String),
  value              Float64,
  provider           LowCardinality(Nullable(String)),
  model              Nullable(String),
  estimatedCost      Nullable(Float64),
  costUnit           LowCardinality(Nullable(String)),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],
  labels             Map(LowCardinality(String), String) DEFAULT map(),

  -- Information-only JSON payloads
  costMetadata       Nullable(String),
  metadata           Nullable(String),
  scope              Nullable(String),

  -- Bloom-filter skip indexes for high-cardinality ID drilldowns.
  -- Equality and IN filters on these columns can skip granule chunks that
  -- definitely do not contain the value. GRANULARITY 2 = 16K-row chunks.
  -- ID columns are out-of-sort-key, so without these every drilldown scans
  -- every row in the time range.
  INDEX idx_traceId traceId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_threadId threadId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_resourceId resourceId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_userId userId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_organizationId organizationId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_experimentId experimentId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_runId runId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_sessionId sessionId TYPE bloom_filter(0.01) GRANULARITY 2,
  INDEX idx_requestId requestId TYPE bloom_filter(0.01) GRANULARITY 2
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(timestamp)
ORDER BY (name, timestamp, metricId)
`;

// ---------------------------------------------------------------------------
// log_events — ReplacingMergeTree with logId dedup
// ---------------------------------------------------------------------------

export const LOG_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_LOG_EVENTS} (
  -- Timestamp
  timestamp          DateTime64(3, 'UTC'),

  -- IDs
  logId              String,
  traceId            Nullable(String),
  spanId             Nullable(String),
  experimentId       Nullable(String),

  -- Entity hierarchy
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Log scalars
  level              LowCardinality(String),
  message            String,

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],

  -- Information-only JSON payloads
  data               Nullable(String),
  metadata           Nullable(String),
  scope              Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(timestamp)
ORDER BY (timestamp, logId)
`;

// ---------------------------------------------------------------------------
// score_events — ReplacingMergeTree with scoreId dedup
// ---------------------------------------------------------------------------

export const SCORE_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_SCORE_EVENTS} (
  -- Timestamp
  timestamp          DateTime64(3, 'UTC'),

  -- IDs
  scoreId            String,
  traceId            Nullable(String),
  spanId             Nullable(String),
  experimentId       Nullable(String),
  scoreTraceId       Nullable(String),

  -- Entity hierarchy
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Scorer identity
  scorerId           LowCardinality(String),
  scorerVersion      LowCardinality(Nullable(String)),
  scoreSource        LowCardinality(Nullable(String)),

  -- Score value
  score              Float64,

  -- Information-only
  reason             Nullable(String),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],

  -- Information-only JSON payloads
  metadata           Nullable(String),
  scope              Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(timestamp)
ORDER BY (traceId, timestamp, scoreId)
SETTINGS allow_nullable_key = 1
`;

// ---------------------------------------------------------------------------
// feedback_events — ReplacingMergeTree with feedbackId dedup
// ---------------------------------------------------------------------------

export const FEEDBACK_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_FEEDBACK_EVENTS} (
  -- Timestamp
  timestamp          DateTime64(3, 'UTC'),

  -- IDs
  feedbackId         String,
  traceId            Nullable(String),
  spanId             Nullable(String),
  experimentId       Nullable(String),

  -- Entity hierarchy
  entityType         LowCardinality(Nullable(String)),
  entityId           Nullable(String),
  entityName         Nullable(String),
  entityVersionId    Nullable(String),
  parentEntityVersionId Nullable(String),
  parentEntityType   LowCardinality(Nullable(String)),
  parentEntityId     Nullable(String),
  parentEntityName   Nullable(String),
  rootEntityVersionId Nullable(String),
  rootEntityType     LowCardinality(Nullable(String)),
  rootEntityId       Nullable(String),
  rootEntityName     Nullable(String),

  -- Context
  userId             Nullable(String),
  organizationId     Nullable(String),
  resourceId         Nullable(String),
  runId              Nullable(String),
  sessionId          Nullable(String),
  threadId           Nullable(String),
  requestId          Nullable(String),
  environment        LowCardinality(Nullable(String)),
  executionSource    LowCardinality(Nullable(String)),
  serviceName        LowCardinality(Nullable(String)),

  -- Feedback actor / linkage
  feedbackUserId     Nullable(String),
  sourceId           Nullable(String),

  -- Feedback identity
  feedbackSource     LowCardinality(String),
  feedbackType       LowCardinality(String),

  -- Feedback value (exactly one non-null per valid row)
  valueString        Nullable(String),
  valueNumber        Nullable(Float64),

  -- Information-only
  comment            Nullable(String),

  -- Query-relevant flexible fields
  tags               Array(LowCardinality(String)) DEFAULT [],

  -- Information-only JSON payloads
  metadata           Nullable(String),
  scope              Nullable(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toDate(timestamp)
ORDER BY (traceId, timestamp, feedbackId)
SETTINGS allow_nullable_key = 1
`;

// ---------------------------------------------------------------------------
// discovery_values — refreshable helper
// ---------------------------------------------------------------------------

export const DISCOVERY_VALUES_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_DISCOVERY_VALUES} (
  kind               LowCardinality(String),
  key1               String,
  value              String
)
ENGINE = MergeTree
ORDER BY (kind, key1, value)
`;

// ---------------------------------------------------------------------------
// discovery_pairs — refreshable helper
// ---------------------------------------------------------------------------

export const DISCOVERY_PAIRS_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE_DISCOVERY_PAIRS} (
  kind               LowCardinality(String),
  key1               String,
  key2               String,
  value              String
)
ENGINE = MergeTree
ORDER BY (kind, key1, key2, value)
`;

// ---------------------------------------------------------------------------
// Refreshable MV: discovery_values — recomputes every 1 minute
// Source: span_events, metric_events, log_events (not scores/feedback)
// ---------------------------------------------------------------------------

const SIGNAL_TABLES = [TABLE_SPAN_EVENTS, TABLE_METRIC_EVENTS, TABLE_LOG_EVENTS] as const;

function unionDistinctFromSignals(
  kind: string,
  key1Expr: string,
  valueExpr: string,
  extraJoin = '',
  extraWhere = '',
  tables: readonly string[] = SIGNAL_TABLES,
): string {
  return tables
    .map(
      t =>
        `SELECT '${kind}' AS kind, ${key1Expr} AS key1, ${valueExpr} AS value FROM ${t}${extraJoin}${extraWhere ? ` WHERE ${extraWhere}` : ''}`,
    )
    .join(' UNION ALL ');
}

export const DISCOVERY_VALUES_MV_DDL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${MV_DISCOVERY_VALUES}
REFRESH EVERY 1 MINUTE
TO ${TABLE_DISCOVERY_VALUES}
AS
SELECT DISTINCT kind, key1, value FROM (
  -- entityType
  ${unionDistinctFromSignals('entityType', "''", 'entityType', '', "entityType IS NOT NULL AND entityType != ''")}
  UNION ALL
  -- serviceName
  ${unionDistinctFromSignals('serviceName', "''", 'serviceName', '', "serviceName IS NOT NULL AND serviceName != ''")}
  UNION ALL
  -- environment
  ${unionDistinctFromSignals('environment', "''", 'environment', '', "environment IS NOT NULL AND environment != ''")}
  UNION ALL
  -- tag (explode tags array, key1 = entityType, drop rows without entityType)
  ${unionDistinctFromSignals('tag', 'entityType', 'tag', ' ARRAY JOIN tags AS tag', "tag != '' AND entityType IS NOT NULL AND entityType != ''")}
  UNION ALL
  -- metricName (metric_events only)
  ${unionDistinctFromSignals('metricName', "''", 'name', '', "name != ''", [TABLE_METRIC_EVENTS])}
  UNION ALL
  -- metricLabelKey (metric_events only, explode label keys)
  ${unionDistinctFromSignals('metricLabelKey', 'name', 'labelKey', ' ARRAY JOIN mapKeys(labels) AS labelKey', "name != '' AND labelKey != ''", [TABLE_METRIC_EVENTS])}
)
`;

// ---------------------------------------------------------------------------
// Refreshable MV: discovery_pairs — recomputes every 5 minutes
// Source: span_events, metric_events, log_events (not scores/feedback)
// ---------------------------------------------------------------------------

export const DISCOVERY_PAIRS_MV_DDL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${MV_DISCOVERY_PAIRS}
REFRESH EVERY 5 MINUTE
TO ${TABLE_DISCOVERY_PAIRS}
AS
SELECT DISTINCT kind, key1, key2, value FROM (
  -- entityTypeName (entityType → entityName pairs)
  ${SIGNAL_TABLES.map(
    t =>
      `SELECT 'entityTypeName' AS kind, entityType AS key1, '' AS key2, entityName AS value FROM ${t} WHERE entityType IS NOT NULL AND entityType != '' AND entityName IS NOT NULL AND entityName != ''`,
  ).join(' UNION ALL ')}
  UNION ALL
  -- metricLabelValue (metricName + labelKey → labelValue triples)
  SELECT 'metricLabelValue' AS kind, name AS key1, labelKey AS key2, labels[labelKey] AS value
  FROM ${TABLE_METRIC_EVENTS}
  ARRAY JOIN mapKeys(labels) AS labelKey
  WHERE name != '' AND labelKey != '' AND labels[labelKey] != ''
)
`;

// ---------------------------------------------------------------------------
// All DDL in creation order (tables first, then MVs)
// ---------------------------------------------------------------------------

export const ALL_TABLE_DDL = [
  SPAN_EVENTS_DDL,
  TRACE_ROOTS_DDL,
  TRACE_BRANCHES_DDL,
  METRIC_EVENTS_DDL,
  LOG_EVENTS_DDL,
  SCORE_EVENTS_DDL,
  FEEDBACK_EVENTS_DDL,
  DISCOVERY_VALUES_DDL,
  DISCOVERY_PAIRS_DDL,
];

export const ALL_MV_DDL = [TRACE_ROOTS_MV_DDL, TRACE_BRANCHES_MV_DDL];

/** Discovery-specific refreshable MVs — created separately from core MVs. */
export const DISCOVERY_MV_DDL = [DISCOVERY_VALUES_MV_DDL, DISCOVERY_PAIRS_MV_DDL];

/**
 * Additive migrations for existing ClickHouse databases.
 * ClickHouse's `CREATE TABLE IF NOT EXISTS` skips if the table already exists,
 * so new columns must be added explicitly via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
 */
export const ALL_MIGRATIONS = [
  // Span events
  `ALTER TABLE ${TABLE_SPAN_EVENTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_SPAN_EVENTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_SPAN_EVENTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Trace roots
  `ALTER TABLE ${TABLE_TRACE_ROOTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_TRACE_ROOTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_TRACE_ROOTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Metrics
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Logs
  `ALTER TABLE ${TABLE_LOG_EVENTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_LOG_EVENTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_LOG_EVENTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Scores
  `ALTER TABLE ${TABLE_SCORE_EVENTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_SCORE_EVENTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_SCORE_EVENTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Feedback
  `ALTER TABLE ${TABLE_FEEDBACK_EVENTS} ADD COLUMN IF NOT EXISTS entityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_FEEDBACK_EVENTS} ADD COLUMN IF NOT EXISTS parentEntityVersionId Nullable(String)`,
  `ALTER TABLE ${TABLE_FEEDBACK_EVENTS} ADD COLUMN IF NOT EXISTS rootEntityVersionId Nullable(String)`,
  // Metric skip indexes — additive, instant DDL. Existing parts keep no index
  // until merged or `MATERIALIZE INDEX` is run; new parts are bloom-filtered
  // immediately. With normal retention turning over the table, the index
  // converges to full coverage without an explicit backfill.
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_traceId traceId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_threadId threadId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_resourceId resourceId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_userId userId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_organizationId organizationId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_experimentId experimentId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_runId runId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_sessionId sessionId TYPE bloom_filter(0.01) GRANULARITY 2`,
  `ALTER TABLE ${TABLE_METRIC_EVENTS} ADD INDEX IF NOT EXISTS idx_requestId requestId TYPE bloom_filter(0.01) GRANULARITY 2`,
];

/**
 * Names of the bloom-filter skip indexes added to `metric_events`. Exposed so
 * tooling (e.g. a follow-up `mastra migrate` command) can detect and optionally
 * `MATERIALIZE INDEX` them across pre-existing parts.
 */
export const METRIC_SKIP_INDEX_NAMES = [
  'idx_traceId',
  'idx_threadId',
  'idx_resourceId',
  'idx_userId',
  'idx_organizationId',
  'idx_experimentId',
  'idx_runId',
  'idx_sessionId',
  'idx_requestId',
] as const;

export const ALL_DDL = [...ALL_TABLE_DDL, ...ALL_MV_DDL, ...DISCOVERY_MV_DDL];

export const ALL_TABLE_NAMES = [
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_ROOTS,
  TABLE_TRACE_BRANCHES,
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_DISCOVERY_VALUES,
  TABLE_DISCOVERY_PAIRS,
];

// ---------------------------------------------------------------------------
// Retention / TTL
// ---------------------------------------------------------------------------

/**
 * Per-signal retention configuration in day increments.
 *
 * Per design doc (shared.md §Retention):
 *   - TTL configurable per signal in day increments
 *   - tracing retention identical across span_events and trace_roots
 *   - discovery helpers do not need TTL (fully derived)
 */
export interface RetentionConfig {
  /** Retention for span_events and trace_roots in days. */
  tracing?: number;
  /** Retention for log_events in days. */
  logs?: number;
  /** Retention for metric_events in days. */
  metrics?: number;
  /** Retention for score_events in days. */
  scores?: number;
  /** Retention for feedback_events in days. */
  feedback?: number;
}

/** Timestamp column used for TTL per signal table. */
const SIGNAL_TTL_COLUMNS: Record<string, string> = {
  [TABLE_SPAN_EVENTS]: 'endedAt',
  [TABLE_TRACE_ROOTS]: 'endedAt',
  [TABLE_TRACE_BRANCHES]: 'endedAt',
  [TABLE_METRIC_EVENTS]: 'timestamp',
  [TABLE_LOG_EVENTS]: 'timestamp',
  [TABLE_SCORE_EVENTS]: 'timestamp',
  [TABLE_FEEDBACK_EVENTS]: 'timestamp',
};

/** Maps each signal key to the table(s) it controls. */
const SIGNAL_TO_TABLES: Record<keyof RetentionConfig, string[]> = {
  tracing: [TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS, TABLE_TRACE_BRANCHES],
  logs: [TABLE_LOG_EVENTS],
  metrics: [TABLE_METRIC_EVENTS],
  scores: [TABLE_SCORE_EVENTS],
  feedback: [TABLE_FEEDBACK_EVENTS],
};

/**
 * Generates `ALTER TABLE ... MODIFY TTL` statements for the given retention config.
 * Returns empty array if no retention is configured.
 *
 * Uses `MODIFY TTL` so re-running init is idempotent (overwrites any previous TTL).
 */
export function buildRetentionDDL(retention: RetentionConfig): string[] {
  const statements: string[] = [];

  for (const [signal, days] of Object.entries(retention)) {
    const safeDays = Math.floor(Number(days));
    if (!Number.isFinite(safeDays) || safeDays <= 0) continue;

    const tables = SIGNAL_TO_TABLES[signal as keyof RetentionConfig];
    if (!tables) continue;

    for (const table of tables) {
      const col = SIGNAL_TTL_COLUMNS[table];
      if (!col) continue;
      statements.push(`ALTER TABLE ${table} MODIFY TTL ${col} + INTERVAL ${safeDays} DAY`);
    }
  }

  return statements;
}
