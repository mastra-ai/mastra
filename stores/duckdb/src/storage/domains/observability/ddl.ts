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

/** DDL for the span_events append-only table. */
export const SPAN_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS span_events (
  -- Event metadata
  eventType VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,

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

  -- JSON fields
  attributes JSON,
  metadata JSON,
  tags JSON,
  scope JSON,
  links JSON,
  input JSON,
  output JSON,
  error JSON
)`;

/** DDL for the metric_events append-only table. */
export const METRIC_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS metric_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,

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

  -- Feedback-specific scalars
  source VARCHAR,
  feedbackSource VARCHAR NOT NULL,
  feedbackType VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  comment VARCHAR,

  -- JSON fields
  tags JSON,
  metadata JSON,
  scope JSON
)`;

/** All observability DDL statements, in creation order. */
export const ALL_DDL = [SPAN_EVENTS_DDL, METRIC_EVENTS_DDL, LOG_EVENTS_DDL, SCORE_EVENTS_DDL, FEEDBACK_EVENTS_DDL];

/** Additive migrations for observability tables created by older versions. */
export const ALL_MIGRATIONS = [
  // Span events
  `ALTER TABLE span_events ADD COLUMN IF NOT EXISTS entityVersionId VARCHAR`,

  // Metrics
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

  // Logs
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

  // Scores
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

  // Feedback
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
  `ALTER TABLE feedback_events ALTER COLUMN traceId DROP NOT NULL`,
];
