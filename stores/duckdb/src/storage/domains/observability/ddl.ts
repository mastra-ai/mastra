/**
 * DDL statements for DuckDB observability tables.
 * All tables use append-only patterns with a single `timestamp` column.
 *
 * Column ordering convention:
 *   1. Event metadata (eventType, timestamp)
 *   2. IDs (trace, span, experiment, resource, run, session, etc.)
 *   3. Entity hierarchy (entity, parent, root)
 *   4. Context (user, org, environment, service, executionSource)
 *   5. Domain-specific scalar fields
 *   6. JSON fields (attributes, metadata, tags, input/output, etc.)
 */

export const SPAN_EVENTS_CURSOR_SEQUENCE_DDL = `
CREATE SEQUENCE IF NOT EXISTS span_events_cursor_id_seq START 1
`;

export const METRIC_EVENTS_CURSOR_SEQUENCE_DDL = `
CREATE SEQUENCE IF NOT EXISTS metric_events_cursor_id_seq START 1
`;

export const LOG_EVENTS_CURSOR_SEQUENCE_DDL = `
CREATE SEQUENCE IF NOT EXISTS log_events_cursor_id_seq START 1
`;

export const SCORE_EVENTS_CURSOR_SEQUENCE_DDL = `
CREATE SEQUENCE IF NOT EXISTS score_events_cursor_id_seq START 1
`;

export const FEEDBACK_EVENTS_CURSOR_SEQUENCE_DDL = `
CREATE SEQUENCE IF NOT EXISTS feedback_events_cursor_id_seq START 1
`;

/** DDL for the span_events append-only table. */
export const SPAN_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS span_events (
  -- Event metadata
  eventType VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  cursorId BIGINT,

  -- IDs
  traceId VARCHAR NOT NULL,
  spanId VARCHAR NOT NULL,
  parentSpanId VARCHAR,
  experimentId VARCHAR,

  -- Entity
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  entityVersionId VARCHAR,
  parentEntityVersionId VARCHAR,
  rootEntityVersionId VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,

  -- Context
  userId VARCHAR,
  organizationId VARCHAR,
  resourceId VARCHAR,
  runId VARCHAR,
  sessionId VARCHAR,
  threadId VARCHAR,
  requestId VARCHAR,
  environment VARCHAR,
  source VARCHAR,
  serviceName VARCHAR,
  requestContext JSON,

  -- Span-specific scalars
  name VARCHAR,
  spanType VARCHAR,
  isEvent BOOLEAN,
  endedAt TIMESTAMP,
  timeToFirstChunkMs DOUBLE,

  -- Native span fields, stored as supplied (NULL when the producer set none)
  externalParentSpanId VARCHAR,
  resumedFromSpanId VARCHAR,
  model VARCHAR,
  provider VARCHAR,
  outcome VARCHAR,
  stopReason VARCHAR,
  timeToFirstTokenMs DOUBLE,
  errorCount INTEGER,

  -- JSON fields
  attributes JSON,
  metadata JSON,
  tags JSON,
  scope JSON,
  links JSON,
  input JSON,
  output JSON,
  error JSON,

  -- Previews of input/output/error in the shared core format, set on the
  -- event rows that carry the matching payload ('' = nothing to preview).
  -- NULL marks a row written before previews were stored, or a row that does
  -- not carry that payload.
  inputPreview VARCHAR,
  outputPreview VARCHAR,
  errorPreview VARCHAR,

  -- Whether this row carries a non-null input/output/error payload. Lets the
  -- light trace list pick each preview's row without reading the payloads.
  -- NULL on rows written before these columns existed.
  hasInputPayload BOOLEAN,
  hasOutputPayload BOOLEAN,
  hasErrorPayload BOOLEAN
)`;

/** DDL for the metric_events append-only table. */
export const METRIC_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS metric_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,
  cursorId BIGINT,

  -- IDs
  metricId VARCHAR NOT NULL PRIMARY KEY,
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,

  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  entityVersionId VARCHAR,
  parentEntityVersionId VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityVersionId VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,

  -- Context
  userId VARCHAR,
  organizationId VARCHAR,
  resourceId VARCHAR,
  runId VARCHAR,
  sessionId VARCHAR,
  threadId VARCHAR,
  requestId VARCHAR,
  environment VARCHAR,
  executionSource VARCHAR,
  serviceName VARCHAR,

  -- Metric-specific scalars
  name VARCHAR NOT NULL,
  value DOUBLE NOT NULL,
  provider VARCHAR,
  model VARCHAR,
  estimatedCost DOUBLE,
  costUnit VARCHAR,

  -- JSON fields
  tags JSON,
  labels JSON,
  costMetadata JSON,
  metadata JSON,
  scope JSON
)`;

/** DDL for the log_events append-only table. */
export const LOG_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS log_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,
  cursorId BIGINT,

  -- IDs
  logId VARCHAR NOT NULL PRIMARY KEY,
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,

  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  entityVersionId VARCHAR,
  parentEntityVersionId VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityVersionId VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,

  -- Context
  userId VARCHAR,
  organizationId VARCHAR,
  resourceId VARCHAR,
  runId VARCHAR,
  sessionId VARCHAR,
  threadId VARCHAR,
  requestId VARCHAR,
  environment VARCHAR,
  executionSource VARCHAR,
  serviceName VARCHAR,

  -- Log-specific scalars
  level VARCHAR NOT NULL,
  message VARCHAR NOT NULL,

  -- JSON fields
  data JSON,
  tags JSON,
  metadata JSON,
  scope JSON
)`;

/** DDL for the score_events append-only table. */
export const SCORE_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS score_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,
  cursorId BIGINT,

  -- IDs
  scoreId VARCHAR NOT NULL PRIMARY KEY,
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,
  scoreTraceId VARCHAR,

  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  entityVersionId VARCHAR,
  parentEntityVersionId VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityVersionId VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,

  -- Context
  userId VARCHAR,
  organizationId VARCHAR,
  resourceId VARCHAR,
  runId VARCHAR,
  sessionId VARCHAR,
  threadId VARCHAR,
  requestId VARCHAR,
  environment VARCHAR,
  executionSource VARCHAR,
  serviceName VARCHAR,

  -- Score-specific scalars
  scorerId VARCHAR NOT NULL,
  scorerVersion VARCHAR,
  source VARCHAR,
  scoreSource VARCHAR,
  score DOUBLE NOT NULL,
  reason VARCHAR,

  -- JSON fields
  tags JSON,
  metadata JSON,
  scope JSON
)`;

/** DDL for the feedback_events append-only table. */
export const FEEDBACK_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS feedback_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,
  cursorId BIGINT,

  -- IDs
  feedbackId VARCHAR NOT NULL PRIMARY KEY,
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,
  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  entityVersionId VARCHAR,
  parentEntityVersionId VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityVersionId VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,

  -- Context
  userId VARCHAR,
  organizationId VARCHAR,
  resourceId VARCHAR,
  runId VARCHAR,
  sessionId VARCHAR,
  threadId VARCHAR,
  requestId VARCHAR,
  environment VARCHAR,
  executionSource VARCHAR,
  serviceName VARCHAR,

  -- Feedback actor / linkage
  feedbackUserId VARCHAR,
  sourceId VARCHAR,

  -- Review workflow
  reviewStatus VARCHAR NOT NULL DEFAULT 'needs-review',

  -- Feedback-specific scalars
  source VARCHAR,
  feedbackSource VARCHAR NOT NULL,
  feedbackType VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  valueString VARCHAR,
  valueNumber DOUBLE,
  comment VARCHAR,

  -- JSON fields
  tags JSON,
  metadata JSON,
  scope JSON
)`;

/** All observability DDL statements, in creation order. */
export const ALL_DDL = [
  SPAN_EVENTS_CURSOR_SEQUENCE_DDL,
  METRIC_EVENTS_CURSOR_SEQUENCE_DDL,
  LOG_EVENTS_CURSOR_SEQUENCE_DDL,
  SCORE_EVENTS_CURSOR_SEQUENCE_DDL,
  FEEDBACK_EVENTS_CURSOR_SEQUENCE_DDL,
  SPAN_EVENTS_DDL,
  METRIC_EVENTS_DDL,
  LOG_EVENTS_DDL,
  SCORE_EVENTS_DDL,
  FEEDBACK_EVENTS_DDL,
];

/** Additive migrations for observability tables created by older versions. */
export const ALL_MIGRATIONS = [
  `CREATE SEQUENCE IF NOT EXISTS span_events_cursor_id_seq START 1`,
  `CREATE SEQUENCE IF NOT EXISTS metric_events_cursor_id_seq START 1`,
  `CREATE SEQUENCE IF NOT EXISTS log_events_cursor_id_seq START 1`,
  `CREATE SEQUENCE IF NOT EXISTS score_events_cursor_id_seq START 1`,
  `CREATE SEQUENCE IF NOT EXISTS feedback_events_cursor_id_seq START 1`,

  // Existing rows intentionally keep NULL cursorId values; delta polling only
  // applies to rows written by insert paths that explicitly call nextval().
  // Databases upgraded from a prior version may still carry a
  // `DEFAULT nextval(...)` on cursorId, which breaks DuckDB WAL replay; that
  // remediation lives in `dropLegacyCursorIdDefaults` and only runs when the
  // bad default is detected in information_schema.
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS cursorId BIGINT`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS parentEntityVersionId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS rootEntityVersionId VARCHAR`,
  // Stored previews. Existing rows keep NULL; readers build their previews
  // from the payload instead (no backfill).
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS inputPreview VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS outputPreview VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS errorPreview VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS hasInputPayload BOOLEAN`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS hasOutputPayload BOOLEAN`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS hasErrorPayload BOOLEAN`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS timeToFirstChunkMs DOUBLE`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS externalParentSpanId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS resumedFromSpanId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS model VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS provider VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS outcome VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS stopReason VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS timeToFirstTokenMs DOUBLE`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS errorCount INTEGER`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS parentEntityType VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS parentEntityId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS parentEntityName VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS rootEntityType VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS rootEntityId VARCHAR`,
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS rootEntityName VARCHAR`,

  // Metrics. Legacy rows remain page-visible but are not part of delta polling.
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS cursorId BIGINT`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS parentEntityVersionId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS rootEntityVersionId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS experimentId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS parentEntityType VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS parentEntityId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS parentEntityName VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS rootEntityType VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS rootEntityId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS rootEntityName VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS userId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS organizationId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS resourceId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS runId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS sessionId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS threadId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS requestId VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS environment VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS executionSource VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS serviceName VARCHAR`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS costMetadata JSON`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS metadata JSON`,
  `ALTER TABLE metric_events ADD COLUMN IF NOT EXISTS scope JSON`,

  // Logs. Legacy rows remain page-visible but are not part of delta polling.
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS cursorId BIGINT`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS parentEntityVersionId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS rootEntityVersionId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS experimentId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS parentEntityType VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS parentEntityId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS parentEntityName VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS rootEntityType VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS rootEntityId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS rootEntityName VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS userId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS organizationId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS resourceId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS runId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS sessionId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS threadId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS requestId VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS environment VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS executionSource VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS serviceName VARCHAR`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS tags JSON`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS metadata JSON`,
  `ALTER TABLE log_events ADD COLUMN IF NOT EXISTS scope JSON`,

  // Scores. Legacy rows remain page-visible but are not part of delta polling.
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS cursorId BIGINT`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS parentEntityVersionId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS rootEntityVersionId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS entityType VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS entityId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS entityName VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS parentEntityType VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS parentEntityId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS parentEntityName VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS rootEntityType VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS rootEntityId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS rootEntityName VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS userId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS organizationId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS resourceId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS runId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS sessionId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS threadId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS requestId VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS environment VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS executionSource VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS serviceName VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS tags JSON`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS scope JSON`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS source VARCHAR`,
  `ALTER TABLE score_events ADD COLUMN IF NOT EXISTS scoreSource VARCHAR`,
  `ALTER TABLE score_events ALTER COLUMN traceId DROP NOT NULL`,

  // Feedback. Legacy rows remain page-visible but are not part of delta polling.
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS cursorId BIGINT`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS parentEntityVersionId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS rootEntityVersionId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS entityType VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS entityId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS entityName VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS parentEntityType VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS parentEntityId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS parentEntityName VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS rootEntityType VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS rootEntityId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS rootEntityName VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS organizationId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS resourceId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS runId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS sessionId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS threadId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS requestId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS environment VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS executionSource VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS serviceName VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS feedbackUserId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS sourceId VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS tags JSON`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS scope JSON`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS source VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS feedbackSource VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS valueString VARCHAR`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS valueNumber DOUBLE`,
  `ALTER TABLE feedback_events ADD COLUMN IF NOT EXISTS reviewStatus VARCHAR DEFAULT 'needs-review'`,
  `ALTER TABLE feedback_events ALTER COLUMN traceId DROP NOT NULL`,
];
