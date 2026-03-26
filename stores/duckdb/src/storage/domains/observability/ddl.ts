/**
 * DDL statements for DuckDB observability tables.
 * All tables use append-only patterns with a single `timestamp` column.
 *
 * Column ordering convention:
 *   1. Event metadata (eventType, timestamp)
 *   2. IDs (trace, span, experiment, resource, run, session, etc.)
 *   3. Entity hierarchy (entity, parent, root)
 *   4. Context (user, org, environment, service, source)
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
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,

  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
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
  traceId VARCHAR,
  spanId VARCHAR,
  experimentId VARCHAR,

  -- Entity hierarchy
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
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
  traceId VARCHAR NOT NULL,
  spanId VARCHAR,
  experimentId VARCHAR,
  scoreTraceId VARCHAR,

  -- Score-specific scalars
  scorerId VARCHAR NOT NULL,
  scorerVersion VARCHAR,
  source VARCHAR,
  score DOUBLE NOT NULL,
  reason VARCHAR,

  -- JSON fields
  metadata JSON
)`;

/** DDL for the feedback_events append-only table. */
export const FEEDBACK_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS feedback_events (
  -- Event metadata
  timestamp TIMESTAMP NOT NULL,

  -- IDs
  traceId VARCHAR NOT NULL,
  spanId VARCHAR,
  experimentId VARCHAR,
  userId VARCHAR,
  sourceId VARCHAR,

  -- Feedback-specific scalars
  source VARCHAR NOT NULL,
  feedbackType VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  comment VARCHAR,

  -- JSON fields
  metadata JSON
)`;

/** All observability DDL statements, in creation order. */
export const ALL_DDL = [SPAN_EVENTS_DDL, METRIC_EVENTS_DDL, LOG_EVENTS_DDL, SCORE_EVENTS_DDL, FEEDBACK_EVENTS_DDL];
