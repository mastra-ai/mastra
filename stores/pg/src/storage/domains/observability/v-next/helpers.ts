/**
 * Shared utilities for the Postgres v-next observability domain.
 *
 * Differences from the ClickHouse v-next helpers:
 *   - jsonb columns are passed through as native objects/arrays. No
 *     JSON.stringify on the way in or JSON.parse on the way out.
 *   - text[] columns are passed as native arrays.
 *   - Timestamps are sent as ISO strings; the pg driver coerces them.
 */

import type {
  CreateFeedbackRecord,
  CreateLogRecord,
  CreateMetricRecord,
  CreateScoreRecord,
  CreateSpanRecord,
  FeedbackRecord,
  LogRecord,
  MetricRecord,
  ScoreRecord,
  SpanRecord,
} from '@mastra/core/storage';
import { EntityType } from '@mastra/core/storage';

const PROMOTED_KEYS = new Set([
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'serviceName',
]);

function nullableString(value: unknown): string | null {
  if (typeof value === 'string') return value === '' ? null : value;
  if (value == null) return null;
  return String(value);
}

function nullableEntityType(value: unknown): EntityType | null {
  const normalized = nullableString(value);
  if (!normalized) return null;
  return Object.values(EntityType).includes(normalized as EntityType) ? (normalized as EntityType) : null;
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function normalizeLabels(labels: Record<string, unknown> | null | undefined): Record<string, string> {
  if (labels == null || typeof labels !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) {
    if (typeof v !== 'string') continue;
    const trimmedK = k.trim();
    const trimmedV = v.trim();
    if (trimmedK === '' || trimmedV === '') continue;
    result[trimmedK] = trimmedV;
  }
  return result;
}

export function buildMetadataSearch(metadata: Record<string, unknown> | null | undefined): Record<string, string> {
  if (metadata == null || typeof metadata !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (PROMOTED_KEYS.has(k)) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed === '') continue;
    result[k] = trimmed;
  }
  return result;
}

export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value == null || value === '') throw new Error(`Invalid date: ${String(value)}`);
  const d = new Date(value as string | number);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return d;
}

export function toDateOrNull(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  if (isNaN(d.getTime()) || d.getTime() === 0) return null;
  return d;
}

export function toIsoOrDate(value: Date | number | string): Date | string {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return value;
}

/** Pass-through for jsonb. Postgres driver does the encoding when given an object. */
function jsonField(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

function parsedJson(value: unknown): unknown {
  if (value == null) return undefined;
  // pg returns parsed jsonb as native objects; if we somehow get a string,
  // attempt to parse it for safety.
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Span ↔ row
// ---------------------------------------------------------------------------

export function spanRecordToRow(span: CreateSpanRecord): Record<string, unknown> {
  const endedAt = span.isEvent ? span.startedAt : (span.endedAt ?? span.startedAt);
  const metadata = span.metadata ?? null;
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? null,
    experimentId: span.experimentId ?? null,
    entityType: span.entityType ?? null,
    entityId: span.entityId ?? null,
    entityName: span.entityName ?? null,
    entityVersionId: span.entityVersionId ?? null,
    parentEntityType: span.parentEntityType ?? null,
    parentEntityId: span.parentEntityId ?? null,
    parentEntityName: span.parentEntityName ?? null,
    parentEntityVersionId: span.parentEntityVersionId ?? null,
    rootEntityType: span.rootEntityType ?? null,
    rootEntityId: span.rootEntityId ?? null,
    rootEntityName: span.rootEntityName ?? null,
    rootEntityVersionId: span.rootEntityVersionId ?? null,
    userId: span.userId ?? null,
    organizationId: span.organizationId ?? null,
    resourceId: span.resourceId ?? null,
    runId: span.runId ?? null,
    sessionId: span.sessionId ?? null,
    threadId: span.threadId ?? null,
    requestId: span.requestId ?? null,
    environment: span.environment ?? null,
    executionSource: span.source ?? null,
    serviceName: span.serviceName ?? null,
    name: span.name,
    spanType: span.spanType,
    isEvent: Boolean(span.isEvent),
    startedAt: toIsoOrDate(span.startedAt),
    endedAt: toIsoOrDate(endedAt),
    tags: normalizeTags(span.tags),
    metadataSearch: buildMetadataSearch(metadata as Record<string, unknown> | null),
    metadataRaw: jsonField(metadata),
    scope: jsonField(span.scope),
    attributes: jsonField(span.attributes),
    links: jsonField(span.links),
    input: jsonField(span.input),
    output: jsonField(span.output),
    error: jsonField(span.error),
    requestContext: jsonField(span.requestContext),
  };
}

export function rowToSpanRecord(row: Record<string, any>): SpanRecord {
  const startedAt = toDate(row.startedAt);
  const endedAt = row.isEvent ? startedAt : toDateOrNull(row.endedAt);
  const error = parsedJson(row.error);
  return {
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: nullableString(row.parentSpanId),
    name: row.name,
    spanType: row.spanType,
    isEvent: Boolean(row.isEvent),
    startedAt,
    endedAt,
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    entityVersionId: nullableString(row.entityVersionId),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    parentEntityVersionId: nullableString(row.parentEntityVersionId),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    rootEntityVersionId: nullableString(row.rootEntityVersionId),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    source: nullableString(row.executionSource),
    serviceName: nullableString(row.serviceName),
    experimentId: nullableString(row.experimentId),
    tags: normalizeTags(row.tags),
    metadata: (parsedJson(row.metadataRaw) as Record<string, unknown> | null) ?? undefined,
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    attributes: (parsedJson(row.attributes) as Record<string, unknown> | null) ?? undefined,
    links: (parsedJson(row.links) as Record<string, unknown>[] | null) ?? undefined,
    input: parsedJson(row.input) ?? undefined,
    output: parsedJson(row.output) ?? undefined,
    error: error ?? undefined,
    requestContext: (parsedJson(row.requestContext) as Record<string, unknown> | null) ?? undefined,
    createdAt: startedAt,
    updatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Log ↔ row
// ---------------------------------------------------------------------------

export function logRecordToRow(log: CreateLogRecord): Record<string, unknown> {
  return {
    logId: log.logId,
    timestamp: toIsoOrDate(log.timestamp),
    level: log.level,
    message: log.message,
    data: jsonField(log.data),
    traceId: log.traceId ?? null,
    spanId: log.spanId ?? null,
    experimentId: log.experimentId ?? null,
    entityType: log.entityType ?? null,
    entityId: log.entityId ?? null,
    entityName: log.entityName ?? null,
    entityVersionId: log.entityVersionId ?? null,
    parentEntityType: log.parentEntityType ?? null,
    parentEntityId: log.parentEntityId ?? null,
    parentEntityName: log.parentEntityName ?? null,
    parentEntityVersionId: log.parentEntityVersionId ?? null,
    rootEntityType: log.rootEntityType ?? null,
    rootEntityId: log.rootEntityId ?? null,
    rootEntityName: log.rootEntityName ?? null,
    rootEntityVersionId: log.rootEntityVersionId ?? null,
    userId: log.userId ?? null,
    organizationId: log.organizationId ?? null,
    resourceId: log.resourceId ?? null,
    runId: log.runId ?? null,
    sessionId: log.sessionId ?? null,
    threadId: log.threadId ?? null,
    requestId: log.requestId ?? null,
    environment: log.environment ?? null,
    executionSource: log.executionSource ?? log.source ?? null,
    serviceName: log.serviceName ?? null,
    tags: normalizeTags(log.tags),
    metadata: jsonField(log.metadata),
    scope: jsonField(log.scope),
  };
}

export function rowToLogRecord(row: Record<string, any>): LogRecord {
  return {
    logId: row.logId,
    timestamp: toDate(row.timestamp),
    level: row.level,
    message: row.message,
    data: (parsedJson(row.data) as Record<string, unknown> | null) ?? undefined,
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    entityVersionId: nullableString(row.entityVersionId),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    parentEntityVersionId: nullableString(row.parentEntityVersionId),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    rootEntityVersionId: nullableString(row.rootEntityVersionId),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    executionSource: nullableString(row.executionSource),
    serviceName: nullableString(row.serviceName),
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    tags: normalizeTags(row.tags),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Metric ↔ row
// ---------------------------------------------------------------------------

export function metricRecordToRow(metric: CreateMetricRecord): Record<string, unknown> {
  return {
    metricId: metric.metricId,
    timestamp: toIsoOrDate(metric.timestamp),
    name: metric.name,
    value: metric.value,
    traceId: metric.traceId ?? null,
    spanId: metric.spanId ?? null,
    experimentId: metric.experimentId ?? null,
    entityType: metric.entityType ?? null,
    entityId: metric.entityId ?? null,
    entityName: metric.entityName ?? null,
    entityVersionId: metric.entityVersionId ?? null,
    parentEntityType: metric.parentEntityType ?? null,
    parentEntityId: metric.parentEntityId ?? null,
    parentEntityName: metric.parentEntityName ?? null,
    parentEntityVersionId: metric.parentEntityVersionId ?? null,
    rootEntityType: metric.rootEntityType ?? null,
    rootEntityId: metric.rootEntityId ?? null,
    rootEntityName: metric.rootEntityName ?? null,
    rootEntityVersionId: metric.rootEntityVersionId ?? null,
    userId: metric.userId ?? null,
    organizationId: metric.organizationId ?? null,
    resourceId: metric.resourceId ?? null,
    runId: metric.runId ?? null,
    sessionId: metric.sessionId ?? null,
    threadId: metric.threadId ?? null,
    requestId: metric.requestId ?? null,
    environment: metric.environment ?? null,
    executionSource: metric.executionSource ?? metric.source ?? null,
    serviceName: metric.serviceName ?? null,
    provider: metric.provider ?? null,
    model: metric.model ?? null,
    estimatedCost: metric.estimatedCost ?? null,
    costUnit: metric.costUnit ?? null,
    tags: normalizeTags(metric.tags),
    labels: normalizeLabels(metric.labels),
    costMetadata: jsonField(metric.costMetadata),
    metadata: jsonField(metric.metadata),
    scope: jsonField(metric.scope),
  };
}

export function rowToMetricRecord(row: Record<string, any>): MetricRecord {
  return {
    metricId: row.metricId,
    timestamp: toDate(row.timestamp),
    name: row.name,
    value: Number(row.value),
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    entityVersionId: nullableString(row.entityVersionId),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    parentEntityVersionId: nullableString(row.parentEntityVersionId),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    rootEntityVersionId: nullableString(row.rootEntityVersionId),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    executionSource: nullableString(row.executionSource),
    serviceName: nullableString(row.serviceName),
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    provider: nullableString(row.provider),
    model: nullableString(row.model),
    estimatedCost: row.estimatedCost == null ? undefined : Number(row.estimatedCost),
    costUnit: nullableString(row.costUnit),
    costMetadata: (parsedJson(row.costMetadata) as Record<string, unknown> | null) ?? undefined,
    tags: normalizeTags(row.tags),
    labels: normalizeLabels(row.labels as Record<string, unknown> | null | undefined),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Score ↔ row
// ---------------------------------------------------------------------------

export function scoreRecordToRow(score: CreateScoreRecord): Record<string, unknown> {
  const metadata = score.metadata ?? null;
  const scoreSource = score.scoreSource ?? score.source ?? null;
  return {
    scoreId: score.scoreId,
    timestamp: toIsoOrDate(score.timestamp),
    traceId: score.traceId ?? null,
    spanId: score.spanId ?? null,
    experimentId: score.experimentId ?? null,
    scoreTraceId: score.scoreTraceId ?? null,
    entityType: score.entityType ?? null,
    entityId: score.entityId ?? null,
    entityName: score.entityName ?? null,
    entityVersionId: score.entityVersionId ?? null,
    parentEntityType: score.parentEntityType ?? null,
    parentEntityId: score.parentEntityId ?? null,
    parentEntityName: score.parentEntityName ?? null,
    parentEntityVersionId: score.parentEntityVersionId ?? null,
    rootEntityType: score.rootEntityType ?? null,
    rootEntityId: score.rootEntityId ?? null,
    rootEntityName: score.rootEntityName ?? null,
    rootEntityVersionId: score.rootEntityVersionId ?? null,
    userId: score.userId ?? null,
    organizationId: score.organizationId ?? null,
    resourceId: score.resourceId ?? null,
    runId: score.runId ?? null,
    sessionId: score.sessionId ?? null,
    threadId: score.threadId ?? null,
    requestId: score.requestId ?? null,
    environment: score.environment ?? null,
    executionSource: score.executionSource ?? null,
    serviceName: score.serviceName ?? null,
    scorerId: score.scorerId,
    scorerVersion: score.scorerVersion ?? null,
    scoreSource,
    score: score.score,
    reason: score.reason ?? null,
    tags: normalizeTags(score.tags),
    metadata: jsonField(metadata),
    scope: jsonField(score.scope),
  };
}

export function rowToScoreRecord(row: Record<string, any>): ScoreRecord {
  return {
    scoreId: row.scoreId,
    timestamp: toDate(row.timestamp),
    traceId: nullableString(row.traceId) as ScoreRecord['traceId'],
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    scoreTraceId: nullableString(row.scoreTraceId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    entityVersionId: nullableString(row.entityVersionId),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    parentEntityVersionId: nullableString(row.parentEntityVersionId),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    rootEntityVersionId: nullableString(row.rootEntityVersionId),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    executionSource: nullableString(row.executionSource),
    serviceName: nullableString(row.serviceName),
    scorerId: row.scorerId,
    scorerVersion: nullableString(row.scorerVersion),
    scoreSource: nullableString(row.scoreSource),
    score: Number(row.score),
    reason: nullableString(row.reason),
    tags: normalizeTags(row.tags),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Feedback ↔ row
// ---------------------------------------------------------------------------

export function feedbackRecordToRow(feedback: CreateFeedbackRecord): Record<string, unknown> {
  const metadata = feedback.metadata ?? null;
  const feedbackSource = feedback.feedbackSource ?? feedback.source ?? '';
  const feedbackUserId = feedback.feedbackUserId ?? feedback.userId ?? null;
  return {
    feedbackId: feedback.feedbackId,
    timestamp: toIsoOrDate(feedback.timestamp),
    traceId: feedback.traceId ?? null,
    spanId: feedback.spanId ?? null,
    experimentId: feedback.experimentId ?? null,
    entityType: feedback.entityType ?? null,
    entityId: feedback.entityId ?? null,
    entityName: feedback.entityName ?? null,
    entityVersionId: feedback.entityVersionId ?? null,
    parentEntityType: feedback.parentEntityType ?? null,
    parentEntityId: feedback.parentEntityId ?? null,
    parentEntityName: feedback.parentEntityName ?? null,
    parentEntityVersionId: feedback.parentEntityVersionId ?? null,
    rootEntityType: feedback.rootEntityType ?? null,
    rootEntityId: feedback.rootEntityId ?? null,
    rootEntityName: feedback.rootEntityName ?? null,
    rootEntityVersionId: feedback.rootEntityVersionId ?? null,
    userId: feedbackUserId,
    organizationId: feedback.organizationId ?? null,
    resourceId: feedback.resourceId ?? null,
    runId: feedback.runId ?? null,
    sessionId: feedback.sessionId ?? null,
    threadId: feedback.threadId ?? null,
    requestId: feedback.requestId ?? null,
    environment: feedback.environment ?? null,
    executionSource: feedback.executionSource ?? null,
    serviceName: feedback.serviceName ?? null,
    feedbackUserId,
    sourceId: feedback.sourceId ?? null,
    feedbackSource,
    feedbackType: feedback.feedbackType,
    valueString: typeof feedback.value === 'string' ? feedback.value : null,
    valueNumber: typeof feedback.value === 'number' ? feedback.value : null,
    comment: feedback.comment ?? null,
    tags: normalizeTags(feedback.tags),
    metadata: jsonField(metadata),
    scope: jsonField(feedback.scope),
  };
}

export function rowToFeedbackRecord(row: Record<string, any>): FeedbackRecord {
  const hasNumber = row.valueNumber != null;
  const feedbackSource = nullableString(row.feedbackSource);
  const feedbackUserId = nullableString(row.feedbackUserId) ?? nullableString(row.userId);
  return {
    feedbackId: row.feedbackId,
    timestamp: toDate(row.timestamp),
    traceId: nullableString(row.traceId) as FeedbackRecord['traceId'],
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    entityVersionId: nullableString(row.entityVersionId),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    parentEntityVersionId: nullableString(row.parentEntityVersionId),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    rootEntityVersionId: nullableString(row.rootEntityVersionId),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    executionSource: nullableString(row.executionSource),
    serviceName: nullableString(row.serviceName),
    feedbackUserId,
    sourceId: nullableString(row.sourceId),
    feedbackSource,
    feedbackType: row.feedbackType,
    value: hasNumber ? Number(row.valueNumber) : (nullableString(row.valueString) ?? ''),
    comment: nullableString(row.comment),
    tags: normalizeTags(row.tags),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}
