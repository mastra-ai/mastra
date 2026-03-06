/**
 * DDL statements for DuckDB observability tables.
 * All tables use append-only patterns with a single `timestamp` column.
 */

export const SPAN_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS span_events (
  eventType VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  traceId VARCHAR NOT NULL,
  spanId VARCHAR NOT NULL,
  parentSpanId VARCHAR,
  name VARCHAR,
  spanType VARCHAR,
  isEvent BOOLEAN,
  startedAt TIMESTAMP,
  endedAt TIMESTAMP,
  experimentId VARCHAR,
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
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
  attributes JSON,
  metadata JSON,
  tags JSON,
  scope JSON,
  links JSON,
  input JSON,
  output JSON,
  error JSON
)`;

export const METRIC_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS metric_events (
  id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  name VARCHAR NOT NULL,
  metricType VARCHAR NOT NULL,
  value DOUBLE NOT NULL,
  labels JSON DEFAULT '{}',
  traceId VARCHAR,
  spanId VARCHAR,
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,
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
  experimentId VARCHAR,
  metadata JSON,
  scope JSON
)`;

export const LOG_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS log_events (
  id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR NOT NULL,
  message VARCHAR NOT NULL,
  data JSON,
  traceId VARCHAR,
  spanId VARCHAR,
  entityType VARCHAR,
  entityId VARCHAR,
  entityName VARCHAR,
  parentEntityType VARCHAR,
  parentEntityId VARCHAR,
  parentEntityName VARCHAR,
  rootEntityType VARCHAR,
  rootEntityId VARCHAR,
  rootEntityName VARCHAR,
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
  experimentId VARCHAR,
  tags JSON,
  metadata JSON,
  scope JSON
)`;

export const SCORE_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS score_events (
  id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  traceId VARCHAR NOT NULL,
  spanId VARCHAR,
  scorerName VARCHAR NOT NULL,
  score DOUBLE NOT NULL,
  reason VARCHAR,
  experimentId VARCHAR,
  metadata JSON
)`;

export const FEEDBACK_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS feedback_events (
  id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  traceId VARCHAR NOT NULL,
  spanId VARCHAR,
  source VARCHAR NOT NULL,
  feedbackType VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  comment VARCHAR,
  experimentId VARCHAR,
  metadata JSON
)`;

export const ALL_DDL = [SPAN_EVENTS_DDL, METRIC_EVENTS_DDL, LOG_EVENTS_DDL, SCORE_EVENTS_DDL, FEEDBACK_EVENTS_DDL];
