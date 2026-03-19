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
  | 'traceId'
  | 'spanId'
  | 'tags'
  | 'entityType'
  | 'entityId'
  | 'entityName'
  | 'parentEntityType'
  | 'parentEntityId'
  | 'parentEntityName'
  | 'rootEntityType'
  | 'rootEntityId'
  | 'rootEntityName'
  | 'userId'
  | 'organizationId'
  | 'resourceId'
  | 'runId'
  | 'sessionId'
  | 'threadId'
  | 'requestId'
  | 'environment'
  | 'source'
  | 'serviceName'
  | 'experimentId'
>;

function buildCorrelationRecordFields(context: CorrelationContext | undefined): CorrelationRecordFields {
  return {
    traceId: context?.traceId ?? null,
    spanId: context?.spanId ?? null,
    tags: context?.tags ?? null,
    entityType: context?.entityType ?? null,
    entityId: context?.entityId ?? null,
    entityName: context?.entityName ?? null,
    parentEntityType: context?.parentEntityType ?? null,
    parentEntityId: context?.parentEntityId ?? null,
    parentEntityName: context?.parentEntityName ?? null,
    rootEntityType: context?.rootEntityType ?? null,
    rootEntityId: context?.rootEntityId ?? null,
    rootEntityName: context?.rootEntityName ?? null,
    userId: context?.userId ?? null,
    organizationId: context?.organizationId ?? null,
    resourceId: context?.resourceId ?? null,
    runId: context?.runId ?? null,
    sessionId: context?.sessionId ?? null,
    threadId: context?.threadId ?? null,
    requestId: context?.requestId ?? null,
    environment: context?.environment ?? null,
    source: context?.source ?? null,
    serviceName: context?.serviceName ?? null,
    experimentId: context?.experimentId ?? null,
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
  const labels = { ...m.labels };
  const correlationFields = buildCorrelationRecordFields(m.correlationContext);
  const cost = m.costContext;

  return {
    timestamp: m.timestamp,
    name: m.name,
    value: m.value,
    labels,
    ...correlationFields,
    scope: null,
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

  return {
    timestamp: l.timestamp,
    level: l.level,
    message: l.message,
    data: l.data ?? null,
    ...correlationFields,
    scope: null,
    metadata: l.metadata ?? null,
  };
}

/** Convert a ScoreEvent to a CreateScoreRecord */
export function buildScoreRecord(event: ScoreEvent): CreateScoreRecord {
  const s = event.score;
  return {
    timestamp: s.timestamp,
    traceId: s.traceId,
    spanId: s.spanId ?? null,
    scorerId: s.scorerId,
    scorerVersion: s.scorerVersion ?? null,
    source: s.source ?? null,
    score: s.score,
    reason: s.reason ?? null,
    experimentId: s.experimentId ?? null,
    scoreTraceId: s.scoreTraceId ?? null,
    metadata: s.metadata ?? null,
  };
}

/** Convert a FeedbackEvent to a CreateFeedbackRecord */
export function buildFeedbackRecord(event: FeedbackEvent): CreateFeedbackRecord {
  const fb = event.feedback;
  const userId = typeof fb.metadata?.userId === 'string' ? fb.metadata.userId : null;
  return {
    timestamp: fb.timestamp,
    traceId: fb.traceId,
    spanId: fb.spanId ?? null,
    source: fb.source,
    feedbackType: fb.feedbackType,
    value: fb.value,
    comment: fb.comment ?? null,
    experimentId: fb.experimentId ?? null,
    userId,
    metadata: fb.metadata ?? null,
  };
}
