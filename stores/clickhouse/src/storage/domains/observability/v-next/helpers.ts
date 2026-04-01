/**
 * Shared utilities for ClickHouse v-next observability domain.
 *
 * - Normalization helpers for tags, labels, metadataSearch
 * - Row-to-record transformation
 * - ClickHouse query settings
 */

import type {
  SpanRecord,
  CreateSpanRecord,
  LogRecord,
  CreateLogRecord,
  MetricRecord,
  CreateMetricRecord,
  ScoreRecord,
  CreateScoreRecord,
  FeedbackRecord,
  CreateFeedbackRecord,
} from '@mastra/core/storage';
import { EntityType } from '@mastra/core/storage';

// ---------------------------------------------------------------------------
// ClickHouse query settings
// ---------------------------------------------------------------------------

export const CH_SETTINGS = {
  date_time_input_format: 'best_effort',
  date_time_output_format: 'iso',
  use_client_time_zone: 1,
  output_format_json_quote_64bit_integers: 0,
} as const;

export const CH_INSERT_SETTINGS = {
  date_time_input_format: 'best_effort',
  use_client_time_zone: 1,
  output_format_json_quote_64bit_integers: 0,
} as const;

const PROMOTED_KEYS = new Set([
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
]);

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? (value === '' ? null : value) : value == null ? null : String(value);
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

export function jsonEncode(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export function parseJson(value: unknown): unknown {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function toDateOrNull(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value as string | number);
  if (isNaN(d.getTime()) || d.getTime() === 0) return null;
  return d;
}

export function toDate(value: unknown): Date {
  const d = toDateOrNull(value);
  if (d == null) throw new Error(`Invalid date: ${value}`);
  return d;
}

export function toISOString(value: Date | number | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  return value;
}

export function buildDedupeKey(traceId: string, spanId: string): string {
  return `${traceId}:${spanId}`;
}

export function rowToSpanRecord(row: Record<string, any>): SpanRecord {
  const startedAt = toDate(row.startedAt);
  const endedAt = row.isEvent ? startedAt : toDateOrNull(row.endedAt);
  const error = parseJson(row.error);

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
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    source: nullableString(row.source),
    serviceName: nullableString(row.serviceName),
    experimentId: nullableString(row.experimentId),
    tags: normalizeTags(row.tags),
    metadata: (parseJson(row.metadataRaw) as Record<string, unknown> | null) ?? undefined,
    scope: (parseJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    attributes: (parseJson(row.attributes) as Record<string, unknown> | null) ?? undefined,
    links: (parseJson(row.links) as Record<string, unknown>[] | null) ?? undefined,
    input: parseJson(row.input) ?? undefined,
    output: parseJson(row.output) ?? undefined,
    error: error ?? undefined,
    requestContext: (parseJson(row.requestContext) as Record<string, unknown> | null) ?? undefined,
    createdAt: startedAt,
    updatedAt: null,
  };
}

export function rowsToSpanRecords(rows: Record<string, any>[]): SpanRecord[] {
  return rows.map(rowToSpanRecord);
}

export function spanRecordToRow(span: CreateSpanRecord): Record<string, unknown> {
  const endedAt = span.isEvent ? span.startedAt : (span.endedAt ?? span.startedAt);
  const metadata = span.metadata ?? null;

  return {
    dedupeKey: buildDedupeKey(span.traceId, span.spanId),
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? null,
    experimentId: span.experimentId ?? null,
    entityType: span.entityType ?? null,
    entityId: span.entityId ?? null,
    entityName: span.entityName ?? null,
    parentEntityType: span.parentEntityType ?? null,
    parentEntityId: span.parentEntityId ?? null,
    parentEntityName: span.parentEntityName ?? null,
    rootEntityType: span.rootEntityType ?? null,
    rootEntityId: span.rootEntityId ?? null,
    rootEntityName: span.rootEntityName ?? null,
    userId: span.userId ?? null,
    organizationId: span.organizationId ?? null,
    resourceId: span.resourceId ?? null,
    runId: span.runId ?? null,
    sessionId: span.sessionId ?? null,
    threadId: span.threadId ?? null,
    requestId: span.requestId ?? null,
    environment: span.environment ?? null,
    source: span.source ?? null,
    serviceName: span.serviceName ?? null,
    name: span.name,
    spanType: span.spanType,
    isEvent: span.isEvent,
    startedAt: toISOString(span.startedAt),
    endedAt: toISOString(endedAt),
    tags: normalizeTags(span.tags),
    metadataSearch: buildMetadataSearch(metadata),
    metadataRaw: jsonEncode(metadata),
    scope: jsonEncode(span.scope),
    attributes: jsonEncode(span.attributes),
    links: jsonEncode(span.links),
    input: jsonEncode(span.input),
    output: jsonEncode(span.output),
    error: jsonEncode(span.error),
    requestContext: jsonEncode(span.requestContext),
  };
}

export function rowToLogRecord(row: Record<string, any>): LogRecord {
  return {
    timestamp: toDate(row.timestamp),
    level: row.level,
    message: row.message,
    data: (parseJson(row.data) as Record<string, unknown> | null) ?? undefined,
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    source: nullableString(row.source),
    executionSource: nullableString(row.source),
    serviceName: nullableString(row.serviceName),
    scope: (parseJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    tags: normalizeTags(row.tags),
    metadata: (parseJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
  };
}

export function logRecordToRow(log: CreateLogRecord): Record<string, unknown> {
  return {
    timestamp: toISOString(log.timestamp),
    level: log.level,
    message: log.message,
    data: jsonEncode(log.data),
    traceId: log.traceId ?? null,
    spanId: log.spanId ?? null,
    experimentId: log.experimentId ?? null,
    entityType: log.entityType ?? null,
    entityId: log.entityId ?? null,
    entityName: log.entityName ?? null,
    parentEntityType: log.parentEntityType ?? null,
    parentEntityId: log.parentEntityId ?? null,
    parentEntityName: log.parentEntityName ?? null,
    rootEntityType: log.rootEntityType ?? null,
    rootEntityId: log.rootEntityId ?? null,
    rootEntityName: log.rootEntityName ?? null,
    userId: log.userId ?? null,
    organizationId: log.organizationId ?? null,
    resourceId: log.resourceId ?? null,
    runId: log.runId ?? null,
    sessionId: log.sessionId ?? null,
    threadId: log.threadId ?? null,
    requestId: log.requestId ?? null,
    environment: log.environment ?? null,
    source: log.executionSource ?? log.source ?? null,
    serviceName: log.serviceName ?? null,
    tags: normalizeTags(log.tags),
    metadata: jsonEncode(log.metadata),
    scope: jsonEncode(log.scope),
  };
}

export function rowToMetricRecord(row: Record<string, any>): MetricRecord {
  return {
    timestamp: toDate(row.timestamp),
    name: row.name,
    value: Number(row.value),
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
    userId: nullableString(row.userId),
    organizationId: nullableString(row.organizationId),
    resourceId: nullableString(row.resourceId),
    runId: nullableString(row.runId),
    sessionId: nullableString(row.sessionId),
    threadId: nullableString(row.threadId),
    requestId: nullableString(row.requestId),
    environment: nullableString(row.environment),
    source: nullableString(row.source),
    executionSource: nullableString(row.source),
    serviceName: nullableString(row.serviceName),
    scope: (parseJson(row.scope) as Record<string, unknown> | null) ?? undefined,
    provider: nullableString(row.provider),
    model: nullableString(row.model),
    estimatedCost: row.estimatedCost == null ? undefined : Number(row.estimatedCost),
    costUnit: nullableString(row.costUnit),
    costMetadata: (parseJson(row.costMetadata) as Record<string, unknown> | null) ?? undefined,
    tags: normalizeTags(row.tags),
    labels: normalizeLabels(row.labels as Record<string, unknown> | null | undefined),
    metadata: (parseJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
  };
}

export function metricRecordToRow(metric: CreateMetricRecord): Record<string, unknown> {
  return {
    timestamp: toISOString(metric.timestamp),
    name: metric.name,
    value: metric.value,
    traceId: metric.traceId ?? null,
    spanId: metric.spanId ?? null,
    experimentId: metric.experimentId ?? null,
    entityType: metric.entityType ?? null,
    entityId: metric.entityId ?? null,
    entityName: metric.entityName ?? null,
    parentEntityType: metric.parentEntityType ?? null,
    parentEntityId: metric.parentEntityId ?? null,
    parentEntityName: metric.parentEntityName ?? null,
    rootEntityType: metric.rootEntityType ?? null,
    rootEntityId: metric.rootEntityId ?? null,
    rootEntityName: metric.rootEntityName ?? null,
    userId: metric.userId ?? null,
    organizationId: metric.organizationId ?? null,
    resourceId: metric.resourceId ?? null,
    runId: metric.runId ?? null,
    sessionId: metric.sessionId ?? null,
    threadId: metric.threadId ?? null,
    requestId: metric.requestId ?? null,
    environment: metric.environment ?? null,
    source: metric.executionSource ?? metric.source ?? null,
    serviceName: metric.serviceName ?? null,
    provider: metric.provider ?? null,
    model: metric.model ?? null,
    estimatedCost: metric.estimatedCost ?? null,
    costUnit: metric.costUnit ?? null,
    tags: normalizeTags(metric.tags),
    labels: normalizeLabels(metric.labels),
    costMetadata: jsonEncode(metric.costMetadata),
    metadata: jsonEncode(metric.metadata),
    scope: jsonEncode(metric.scope),
  };
}

export function rowToScoreRecord(row: Record<string, any>): ScoreRecord {
  return {
    timestamp: toDate(row.timestamp),
    traceId: row.traceId,
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    scoreTraceId: nullableString(row.scoreTraceId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
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
    source: nullableString(row.scoreSource) ?? nullableString(row.source),
    scoreSource: nullableString(row.scoreSource) ?? nullableString(row.source),
    score: Number(row.score),
    reason: nullableString(row.reason),
    tags: normalizeTags(row.tags),
    metadata: (parseJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parseJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}

export function scoreRecordToRow(score: CreateScoreRecord): Record<string, unknown> {
  const metadata = score.metadata ?? null;
  const scoreSource = score.scoreSource ?? score.source ?? null;

  return {
    timestamp: toISOString(score.timestamp),
    traceId: score.traceId,
    spanId: score.spanId ?? null,
    experimentId: score.experimentId ?? null,
    scoreTraceId: score.scoreTraceId ?? null,
    entityType: score.entityType ?? null,
    entityId: score.entityId ?? null,
    entityName: score.entityName ?? null,
    parentEntityType: score.parentEntityType ?? null,
    parentEntityId: score.parentEntityId ?? null,
    parentEntityName: score.parentEntityName ?? null,
    rootEntityType: score.rootEntityType ?? null,
    rootEntityId: score.rootEntityId ?? null,
    rootEntityName: score.rootEntityName ?? null,
    userId: score.userId ?? null,
    organizationId:
      score.organizationId ??
      (typeof (score.metadata as Record<string, unknown> | undefined)?.organizationId === 'string'
        ? ((score.metadata as Record<string, unknown>).organizationId as string)
        : null),
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
    source: scoreSource,
    scoreSource,
    score: score.score,
    reason: score.reason ?? null,
    tags: normalizeTags(score.tags),
    metadata: jsonEncode(metadata),
    scope: jsonEncode(score.scope),
  };
}

export function rowToFeedbackRecord(row: Record<string, any>): FeedbackRecord {
  const hasNumber = row.valueNumber != null;
  const feedbackSource = nullableString(row.feedbackSource) ?? row.source;
  const feedbackUserId = nullableString(row.feedbackUserId) ?? nullableString(row.userId);
  return {
    timestamp: toDate(row.timestamp),
    traceId: row.traceId,
    spanId: nullableString(row.spanId),
    experimentId: nullableString(row.experimentId),
    entityType: nullableEntityType(row.entityType),
    entityId: nullableString(row.entityId),
    entityName: nullableString(row.entityName),
    parentEntityType: nullableEntityType(row.parentEntityType),
    parentEntityId: nullableString(row.parentEntityId),
    parentEntityName: nullableString(row.parentEntityName),
    rootEntityType: nullableEntityType(row.rootEntityType),
    rootEntityId: nullableString(row.rootEntityId),
    rootEntityName: nullableString(row.rootEntityName),
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
    source: feedbackSource,
    feedbackSource,
    feedbackType: row.feedbackType,
    value: hasNumber ? Number(row.valueNumber) : (nullableString(row.valueString) ?? ''),
    comment: nullableString(row.comment),
    tags: normalizeTags(row.tags),
    metadata: (parseJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parseJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}

export function feedbackRecordToRow(feedback: CreateFeedbackRecord): Record<string, unknown> {
  const metadata = feedback.metadata ?? null;
  const feedbackSource = feedback.feedbackSource ?? feedback.source;
  const feedbackUserId =
    feedback.feedbackUserId ??
    feedback.userId ??
    (typeof (feedback.metadata as Record<string, unknown> | undefined)?.userId === 'string'
      ? ((feedback.metadata as Record<string, unknown>).userId as string)
      : null);

  return {
    timestamp: toISOString(feedback.timestamp),
    traceId: feedback.traceId,
    spanId: feedback.spanId ?? null,
    experimentId: feedback.experimentId ?? null,
    entityType: feedback.entityType ?? null,
    entityId: feedback.entityId ?? null,
    entityName: feedback.entityName ?? null,
    parentEntityType: feedback.parentEntityType ?? null,
    parentEntityId: feedback.parentEntityId ?? null,
    parentEntityName: feedback.parentEntityName ?? null,
    rootEntityType: feedback.rootEntityType ?? null,
    rootEntityId: feedback.rootEntityId ?? null,
    rootEntityName: feedback.rootEntityName ?? null,
    userId: feedbackUserId,
    organizationId:
      feedback.organizationId ??
      (typeof (feedback.metadata as Record<string, unknown> | undefined)?.organizationId === 'string'
        ? ((feedback.metadata as Record<string, unknown>).organizationId as string)
        : null),
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
    source: feedbackSource,
    feedbackSource,
    feedbackType: feedback.feedbackType,
    valueString: typeof feedback.value === 'string' ? feedback.value : null,
    valueNumber: typeof feedback.value === 'number' ? feedback.value : null,
    comment: feedback.comment ?? null,
    tags: normalizeTags(feedback.tags),
    metadata: jsonEncode(metadata),
    scope: jsonEncode(feedback.scope),
  };
}
