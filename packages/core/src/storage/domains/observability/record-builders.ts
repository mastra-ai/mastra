import type {
  AnyExportedSpan,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
} from '../../../observability/index.js';
import type { CorrelationContext } from '../../../observability/types/core.js';
import { EntityType } from '../../../observability/types/tracing.js';
import type { CreateFeedbackRecord } from './feedback.js';
import type { CreateLogRecord } from './logs.js';
import type { CreateMetricRecord } from './metrics.js';
import type { CreateScoreRecord } from './scores.js';
import type { CreateSpanRecord, UpdateSpanRecord } from './tracing.js';

// ============================================================================
// Shared helpers for extracting typed fields from untyped metadata/labels
// ============================================================================

const entityTypeValues = new Set(Object.values(EntityType));

/** Safely cast string to EntityType, returning null if invalid */
export function toEntityType(value: string | undefined | null): EntityType | null {
  if (value && entityTypeValues.has(value as EntityType)) {
    return value as EntityType;
  }
  return null;
}

/** Extract a string from an unknown value, returning null if not a string. */
export function getStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Extract a plain object from an unknown value, returning null if not an object. */
export function getObjectOrNull(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null;
}

// ============================================================================
// Span attribute serialization
// ============================================================================

/**
 * Serializes span attributes to a plain JSON-safe object.
 * Handles Date objects and nested structures.
 */
export function serializeSpanAttributes(span: AnyExportedSpan): Record<string, any> | null {
  if (!span.attributes) {
    return null;
  }

  try {
    return JSON.parse(
      JSON.stringify(span.attributes, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }),
    );
  } catch {
    return null;
  }
}

type CorrelationRecordFields = Pick<
  CreateLogRecord,
  | 'tags'
  | 'entityType'
  | 'entityId'
  | 'entityName'
  | 'entityVersionId'
  | 'parentEntityType'
  | 'parentEntityId'
  | 'parentEntityName'
  | 'parentEntityVersionId'
  | 'rootEntityType'
  | 'rootEntityId'
  | 'rootEntityName'
  | 'rootEntityVersionId'
  | 'userId'
  | 'organizationId'
  | 'resourceId'
  | 'runId'
  | 'sessionId'
  | 'threadId'
  | 'requestId'
  | 'environment'
  | 'executionSource'
  | 'serviceName'
  | 'experimentId'
>;

function buildCorrelationRecordFields(context: CorrelationContext | undefined): CorrelationRecordFields {
  return {
    tags: context?.tags ?? null,
    entityType: context?.entityType ?? null,
    entityId: context?.entityId ?? null,
    entityName: context?.entityName ?? null,
    entityVersionId: context?.entityVersionId ?? null,
    parentEntityType: context?.parentEntityType ?? null,
    parentEntityId: context?.parentEntityId ?? null,
    parentEntityName: context?.parentEntityName ?? null,
    parentEntityVersionId: context?.parentEntityVersionId ?? null,
    rootEntityType: context?.rootEntityType ?? null,
    rootEntityId: context?.rootEntityId ?? null,
    rootEntityName: context?.rootEntityName ?? null,
    rootEntityVersionId: context?.rootEntityVersionId ?? null,
    userId: context?.userId ?? null,
    organizationId: context?.organizationId ?? null,
    resourceId: context?.resourceId ?? null,
    runId: context?.runId ?? null,
    sessionId: context?.sessionId ?? null,
    threadId: context?.threadId ?? null,
    requestId: context?.requestId ?? null,
    environment: context?.environment ?? null,
    executionSource: context?.source ?? null,
    serviceName: context?.serviceName ?? null,
    experimentId: context?.experimentId ?? null,
  };
}

function buildLegacyMetricLabelCorrelationFields(labels: Record<string, string>): Partial<CorrelationRecordFields> {
  return {
    entityType: toEntityType(labels.entity_type),
    entityName: getStringOrNull(labels.entity_name),
    parentEntityType: toEntityType(labels.parent_type),
    parentEntityName: getStringOrNull(labels.parent_name),
    serviceName: getStringOrNull(labels.service_name),
  };
}

function stripLegacyMetricCorrelationLabels(labels: Record<string, string>): Record<string, string> {
  const sanitized = { ...labels };
  delete sanitized.entity_type;
  delete sanitized.entity_name;
  delete sanitized.parent_type;
  delete sanitized.parent_name;
  delete sanitized.service_name;
  return sanitized;
}

function buildLegacyLogMetadataCorrelationFields(
  metadata: Record<string, any> | null,
): Partial<CorrelationRecordFields> {
  return {
    entityType: toEntityType(getStringOrNull(metadata?.entity_type) ?? undefined),
    entityName: getStringOrNull(metadata?.entity_name),
    parentEntityType: toEntityType(getStringOrNull(metadata?.parent_type) ?? undefined),
    parentEntityName: getStringOrNull(metadata?.parent_name),
    rootEntityType: toEntityType(getStringOrNull(metadata?.root_type) ?? undefined),
    rootEntityName: getStringOrNull(metadata?.root_name),
    environment: getStringOrNull(metadata?.environment),
    executionSource: getStringOrNull(metadata?.source),
    serviceName: getStringOrNull(metadata?.service_name),
  };
}

// ============================================================================
// Event → Record builders
// ============================================================================

/** Convert an exported span to a CreateSpanRecord */
export function buildCreateSpanRecord(span: AnyExportedSpan): CreateSpanRecord {
  const metadata = span.metadata ?? {};

  return {
    traceId: span.traceId,
    spanId: span.id,
    parentSpanId: span.parentSpanId ?? null,
    name: span.name,

    // Entity identification - from span
    entityType: span.entityType ?? null,
    entityId: span.entityId ?? null,
    entityName: span.entityName ?? null,
    entityVersionId: getStringOrNull(metadata.entityVersionId),

    // Identity & Tenancy - extracted from metadata if present
    userId: getStringOrNull(metadata.userId),
    organizationId: getStringOrNull(metadata.organizationId),
    resourceId: getStringOrNull(metadata.resourceId),

    // Correlation IDs - extracted from metadata if present
    runId: getStringOrNull(metadata.runId),
    sessionId: getStringOrNull(metadata.sessionId),
    threadId: getStringOrNull(metadata.threadId),
    requestId: getStringOrNull(metadata.requestId),

    // Deployment context - extracted from metadata if present
    environment: getStringOrNull(metadata.environment),
    source: getStringOrNull(metadata.source),
    serviceName: getStringOrNull(metadata.serviceName),
    scope: getObjectOrNull(metadata.scope),

    // Experimentation
    experimentId: getStringOrNull(metadata.experimentId),

    // Span data
    spanType: span.type,
    attributes: serializeSpanAttributes(span),
    metadata: span.metadata ?? null,
    tags: span.tags ?? null,
    links: null,
    input: span.input ?? null,
    output: span.output ?? null,
    error: span.errorInfo ?? null,
    isEvent: span.isEvent,

    // Request context
    requestContext: span.requestContext ?? null,

    // Timestamps
    startedAt: span.startTime,
    endedAt: span.endTime ?? null,
  };
}

/** Convert an exported span to a partial UpdateSpanRecord */
export function buildUpdateSpanRecord(span: AnyExportedSpan): Partial<UpdateSpanRecord> {
  return {
    name: span.name,
    scope: null,
    attributes: serializeSpanAttributes(span),
    metadata: span.metadata ?? null,
    links: null,
    endedAt: span.endTime ?? null,
    input: span.input,
    output: span.output,
    error: span.errorInfo ?? null,
  };
}

/** Convert a MetricEvent to a CreateMetricRecord. */
export function buildMetricRecord(event: MetricEvent): CreateMetricRecord {
  const m = event.metric;
  const labels = stripLegacyMetricCorrelationLabels(m.labels);
  const correlationFields = buildCorrelationRecordFields(m.correlationContext);
  const legacyCorrelationFields = buildLegacyMetricLabelCorrelationFields(m.labels);
  const cost = m.costContext;

  return {
    metricId: m.metricId,
    timestamp: m.timestamp,
    name: m.name,
    value: m.value,
    labels,
    traceId: m.traceId ?? m.correlationContext?.traceId ?? null,
    spanId: m.spanId ?? m.correlationContext?.spanId ?? null,
    ...correlationFields,
    scope: null,
    entityType: correlationFields.entityType ?? legacyCorrelationFields.entityType ?? null,
    entityName: correlationFields.entityName ?? legacyCorrelationFields.entityName ?? null,
    parentEntityType: correlationFields.parentEntityType ?? legacyCorrelationFields.parentEntityType ?? null,
    parentEntityName: correlationFields.parentEntityName ?? legacyCorrelationFields.parentEntityName ?? null,
    serviceName: correlationFields.serviceName ?? legacyCorrelationFields.serviceName ?? null,
    provider: cost?.provider ?? null,
    model: cost?.model ?? null,
    estimatedCost: cost?.estimatedCost ?? null,
    costUnit: cost?.costUnit ?? null,
    costMetadata: cost?.costMetadata ?? null,
    metadata: m.metadata ?? null,
  };
}

/** Convert a LogEvent to a CreateLogRecord */
export function buildLogRecord(event: LogEvent): CreateLogRecord {
  const l = event.log;
  const correlationFields = buildCorrelationRecordFields(l.correlationContext);
  const legacyCorrelationFields = buildLegacyLogMetadataCorrelationFields(l.metadata ?? null);

  return {
    logId: l.logId,
    timestamp: l.timestamp,
    level: l.level,
    message: l.message,
    data: l.data ?? null,
    ...correlationFields,
    traceId: l.traceId ?? l.correlationContext?.traceId ?? null,
    spanId: l.spanId ?? l.correlationContext?.spanId ?? null,
    tags: correlationFields.tags ?? l.tags ?? null,
    entityType: correlationFields.entityType ?? legacyCorrelationFields.entityType ?? null,
    entityName: correlationFields.entityName ?? legacyCorrelationFields.entityName ?? null,
    parentEntityType: correlationFields.parentEntityType ?? legacyCorrelationFields.parentEntityType ?? null,
    parentEntityName: correlationFields.parentEntityName ?? legacyCorrelationFields.parentEntityName ?? null,
    rootEntityType: correlationFields.rootEntityType ?? legacyCorrelationFields.rootEntityType ?? null,
    rootEntityName: correlationFields.rootEntityName ?? legacyCorrelationFields.rootEntityName ?? null,
    environment: correlationFields.environment ?? legacyCorrelationFields.environment ?? null,
    executionSource: correlationFields.executionSource ?? legacyCorrelationFields.executionSource ?? null,
    serviceName: correlationFields.serviceName ?? legacyCorrelationFields.serviceName ?? null,
    scope: null,
    metadata: l.metadata ?? null,
  };
}

/** Convert a ScoreEvent to a CreateScoreRecord */
export function buildScoreRecord(event: ScoreEvent): CreateScoreRecord {
  const s = event.score;
  const correlationFields = buildCorrelationRecordFields(s.correlationContext);
  return {
    scoreId: s.scoreId,
    timestamp: s.timestamp,
    traceId: s.traceId ?? s.correlationContext?.traceId ?? null,
    spanId: s.spanId ?? s.correlationContext?.spanId ?? null,
    scorerId: s.scorerId,
    scorerVersion: s.scorerVersion ?? null,
    scoreSource: s.scoreSource ?? s.source ?? null,
    source: s.scoreSource ?? s.source ?? null,
    score: s.score,
    reason: s.reason ?? null,
    ...correlationFields,
    entityType: correlationFields.entityType ?? s.targetEntityType ?? null,
    experimentId: correlationFields.experimentId ?? s.experimentId ?? null,
    scope: null,
    scoreTraceId: s.scoreTraceId ?? null,
    metadata: s.scorerName ? { ...(s.metadata ?? {}), scorerName: s.scorerName } : (s.metadata ?? null),
  };
}

/** Convert a FeedbackEvent to a CreateFeedbackRecord */
export function buildFeedbackRecord(event: FeedbackEvent): CreateFeedbackRecord {
  const fb = event.feedback;
  const correlationFields = buildCorrelationRecordFields(fb.correlationContext);
  return {
    feedbackId: fb.feedbackId,
    timestamp: fb.timestamp,
    traceId: fb.traceId ?? fb.correlationContext?.traceId ?? null,
    spanId: fb.spanId ?? fb.correlationContext?.spanId ?? null,
    feedbackSource: fb.feedbackSource ?? fb.source ?? '',
    source: fb.feedbackSource ?? fb.source ?? '',
    feedbackType: fb.feedbackType,
    value: fb.value,
    comment: fb.comment ?? null,
    ...correlationFields,
    experimentId: correlationFields.experimentId ?? fb.experimentId ?? null,
    feedbackUserId:
      fb.feedbackUserId ?? fb.userId ?? (typeof fb.metadata?.userId === 'string' ? fb.metadata.userId : null),
    scope: null,
    sourceId: fb.sourceId ?? null,
    metadata: fb.metadata ?? null,
  };
}
