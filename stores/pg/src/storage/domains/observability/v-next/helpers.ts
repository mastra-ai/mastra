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
  LightSpanRecord,
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
  if (isNaN(d.getTime())) return null;
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
// Common context — the ~23 identity / hierarchy / execution-context columns
// every signal carries. Extracted so each per-signal converter stays focused
// on its signal-specific fields.
//
// `traceId` / `spanId` are intentionally excluded: spans treat them as
// non-null required, while scores / feedback have a legacy `string`-not-
// nullable type even though the column is actually nullable. Both cases need
// per-signal handling.
//
// Spans use `source` in the record but `executionSource` in the row. The
// write helper accepts either; the read helper returns `executionSource` and
// callers that need `source` (i.e. spans) destructure-and-rename.
// ---------------------------------------------------------------------------

function rowToCommonContext(row: Record<string, any>) {
  return {
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
  };
}

interface CommonContextWritable {
  experimentId?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  entityName?: string | null;
  entityVersionId?: string | null;
  parentEntityType?: EntityType | null;
  parentEntityId?: string | null;
  parentEntityName?: string | null;
  parentEntityVersionId?: string | null;
  rootEntityType?: EntityType | null;
  rootEntityId?: string | null;
  rootEntityName?: string | null;
  rootEntityVersionId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  resourceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  requestId?: string | null;
  environment?: string | null;
  /** Preferred field; the legacy `source` is accepted as a fallback (used by spans). */
  executionSource?: string | null;
  source?: string | null;
  serviceName?: string | null;
}

function commonContextToRow(record: CommonContextWritable): Record<string, unknown> {
  return {
    experimentId: record.experimentId ?? null,
    entityType: record.entityType ?? null,
    entityId: record.entityId ?? null,
    entityName: record.entityName ?? null,
    entityVersionId: record.entityVersionId ?? null,
    parentEntityType: record.parentEntityType ?? null,
    parentEntityId: record.parentEntityId ?? null,
    parentEntityName: record.parentEntityName ?? null,
    parentEntityVersionId: record.parentEntityVersionId ?? null,
    rootEntityType: record.rootEntityType ?? null,
    rootEntityId: record.rootEntityId ?? null,
    rootEntityName: record.rootEntityName ?? null,
    rootEntityVersionId: record.rootEntityVersionId ?? null,
    userId: record.userId ?? null,
    organizationId: record.organizationId ?? null,
    resourceId: record.resourceId ?? null,
    runId: record.runId ?? null,
    sessionId: record.sessionId ?? null,
    threadId: record.threadId ?? null,
    requestId: record.requestId ?? null,
    environment: record.environment ?? null,
    executionSource: record.executionSource ?? record.source ?? null,
    serviceName: record.serviceName ?? null,
  };
}

// ---------------------------------------------------------------------------
// Span ↔ row
// ---------------------------------------------------------------------------

export function spanRecordToRow(span: CreateSpanRecord): Record<string, unknown> {
  const endedAt = span.isEvent ? span.startedAt : (span.endedAt ?? span.startedAt);
  const metadata = span.metadata ?? null;
  return {
    ...commonContextToRow(span),
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? null,
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
  // Spans expose the row's `executionSource` column as `source` on the record.
  const { executionSource, ...ctx } = rowToCommonContext(row);
  return {
    ...ctx,
    source: executionSource,
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: nullableString(row.parentSpanId),
    name: row.name,
    spanType: row.spanType,
    isEvent: Boolean(row.isEvent),
    startedAt,
    endedAt,
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

/**
 * Build a {@link LightSpanRecord} from a row that projected only the light
 * column set (see `SPAN_LIGHT_SELECT_COLUMNS` in sql.ts). Used by
 * `getTraceLight` — the timeline view doesn't need the full span payload.
 */
export function rowToLightSpanRecord(row: Record<string, any>): LightSpanRecord {
  const startedAt = toDate(row.startedAt);
  const endedAt = row.isEvent ? startedAt : toDateOrNull(row.endedAt);
  return {
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: row.parentSpanId == null || row.parentSpanId === '' ? null : String(row.parentSpanId),
    name: row.name,
    spanType: row.spanType,
    isEvent: Boolean(row.isEvent),
    startedAt,
    endedAt,
    entityType:
      row.entityType == null || row.entityType === ''
        ? null
        : Object.values(EntityType).includes(row.entityType as EntityType)
          ? (row.entityType as EntityType)
          : null,
    entityId: row.entityId == null || row.entityId === '' ? null : String(row.entityId),
    entityName: row.entityName == null || row.entityName === '' ? null : String(row.entityName),
    error: (parsedJson(row.error) as Record<string, unknown> | null) ?? undefined,
    createdAt: startedAt,
    updatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Log ↔ row
// ---------------------------------------------------------------------------

export function logRecordToRow(log: CreateLogRecord): Record<string, unknown> {
  return {
    ...commonContextToRow(log),
    logId: log.logId,
    timestamp: toIsoOrDate(log.timestamp),
    level: log.level,
    message: log.message,
    data: jsonField(log.data),
    traceId: log.traceId ?? null,
    spanId: log.spanId ?? null,
    tags: normalizeTags(log.tags),
    metadata: jsonField(log.metadata),
    scope: jsonField(log.scope),
  };
}

export function rowToLogRecord(row: Record<string, any>): LogRecord {
  return {
    ...rowToCommonContext(row),
    logId: row.logId,
    timestamp: toDate(row.timestamp),
    level: row.level,
    message: row.message,
    data: (parsedJson(row.data) as Record<string, unknown> | null) ?? undefined,
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    tags: normalizeTags(row.tags),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Metric ↔ row
// ---------------------------------------------------------------------------

export function metricRecordToRow(metric: CreateMetricRecord): Record<string, unknown> {
  return {
    ...commonContextToRow(metric),
    metricId: metric.metricId,
    timestamp: toIsoOrDate(metric.timestamp),
    name: metric.name,
    value: metric.value,
    traceId: metric.traceId ?? null,
    spanId: metric.spanId ?? null,
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
    ...rowToCommonContext(row),
    metricId: row.metricId,
    timestamp: toDate(row.timestamp),
    name: row.name,
    value: Number(row.value),
    traceId: nullableString(row.traceId),
    spanId: nullableString(row.spanId),
    provider: nullableString(row.provider),
    model: nullableString(row.model),
    estimatedCost: row.estimatedCost == null ? undefined : Number(row.estimatedCost),
    costUnit: nullableString(row.costUnit),
    costMetadata: (parsedJson(row.costMetadata) as Record<string, unknown> | null) ?? undefined,
    tags: normalizeTags(row.tags),
    labels: normalizeLabels(row.labels as Record<string, unknown> | null | undefined),
    metadata: (parsedJson(row.metadata) as Record<string, unknown> | null) ?? undefined,
    scope: (parsedJson(row.scope) as Record<string, unknown> | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Score ↔ row
// ---------------------------------------------------------------------------

export function scoreRecordToRow(score: CreateScoreRecord): Record<string, unknown> {
  const metadata = score.metadata ?? null;
  const scoreSource = score.scoreSource ?? score.source ?? null;
  return {
    ...commonContextToRow(score),
    scoreId: score.scoreId,
    timestamp: toIsoOrDate(score.timestamp),
    traceId: score.traceId ?? null,
    spanId: score.spanId ?? null,
    scoreTraceId: score.scoreTraceId ?? null,
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
    ...rowToCommonContext(row),
    scoreId: row.scoreId,
    timestamp: toDate(row.timestamp),
    // Legacy schema types traceId as required string even though the column is nullable.
    traceId: nullableString(row.traceId) as ScoreRecord['traceId'],
    spanId: nullableString(row.spanId),
    scoreTraceId: nullableString(row.scoreTraceId),
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
  // userId (app user, via commonContextToRow) and feedbackUserId (evaluator)
  // are distinct fields on FeedbackRecord. Legacy `FeedbackInput.userId` →
  // `feedbackUserId` aliasing is handled by `normalizeLegacyFeedbackActor`
  // at the schema layer, so the helper writes each through unchanged.
  return {
    ...commonContextToRow(feedback),
    feedbackId: feedback.feedbackId,
    timestamp: toIsoOrDate(feedback.timestamp),
    traceId: feedback.traceId ?? null,
    spanId: feedback.spanId ?? null,
    feedbackUserId: feedback.feedbackUserId ?? null,
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
  return {
    ...rowToCommonContext(row),
    feedbackId: row.feedbackId,
    timestamp: toDate(row.timestamp),
    // Legacy schema types traceId as required string even though the column is nullable.
    traceId: nullableString(row.traceId) as FeedbackRecord['traceId'],
    spanId: nullableString(row.spanId),
    feedbackUserId: nullableString(row.feedbackUserId),
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
