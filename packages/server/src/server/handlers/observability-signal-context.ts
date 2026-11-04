import { contextFields } from '@internal/core/storage';
import type { ObservabilityStorage, SpanRecord } from '@mastra/core/storage';
import { z } from 'zod/v4';
import { MASTRA_RESOURCE_ID_KEY } from '../constants';
import { HTTPException } from '../http-exception';

const contextSchema = z.object(contextFields);
type SignalContext = z.infer<typeof contextSchema>;

function missingAnchor(code: 'TRACE_NOT_FOUND' | 'SPAN_NOT_FOUND'): never {
  const error = code === 'TRACE_NOT_FOUND' ? 'Trace not found' : 'Span not found';
  throw new HTTPException(404, {
    message: error,
    res: Response.json({ success: false, code, error }, { status: 404 }),
  });
}

/** Mirrors recorded-span correlation context, requiring a persisted root for its tags. */
export async function resolveSignalContext(
  store: ObservabilityStorage,
  requestContext: { get(key: string): unknown },
  record: SignalContext & { traceId: string; spanId?: string | null; metadata?: Record<string, unknown> | null },
  mode: 'provided' | 'resolve' = 'provided',
): Promise<SignalContext & { metadata?: Record<string, unknown> | null }> {
  const organizationId = requestContext.get('organizationId');
  const resourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  const scope = {
    ...(typeof organizationId === 'string' && organizationId ? { organizationId } : {}),
    ...(typeof resourceId === 'string' && resourceId ? { resourceId } : {}),
  };
  // Configured scope fields override input; other provided context stays caller-supplied.
  if (mode === 'provided') return { ...contextSchema.parse(record), ...scope, metadata: record.metadata };

  // Like trace queries, absent trusted scope means unscoped self-hosted access.
  // getTrace has no scope argument, so enforce every configured scope field here.
  // Caller-supplied context must never establish or widen that trusted scope.
  const trace = await store.getTrace({ traceId: record.traceId });
  const spans = (trace?.spans ?? []).filter(
    span =>
      span.traceId === record.traceId &&
      (!scope.organizationId || span.organizationId === scope.organizationId) &&
      (!scope.resourceId || span.resourceId === scope.resourceId),
  );
  const latestFirst = (a: SpanRecord, b: SpanRecord) =>
    (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0) ||
    (a.spanId === b.spanId ? 0 : a.spanId > b.spanId ? -1 : 1);
  const root = spans.filter(span => span.parentSpanId == null).sort(latestFirst)[0];
  if (!root) missingAnchor('TRACE_NOT_FOUND');
  const target = record.spanId == null ? root : spans.find(span => span.spanId === record.spanId);
  if (!target) missingAnchor('SPAN_NOT_FOUND');
  const spansById = new Map(spans.map(span => [span.spanId, span]));
  let selectedRoot = target;
  const visited = new Set<string>();
  while (selectedRoot.parentSpanId != null) {
    if (visited.has(selectedRoot.spanId)) missingAnchor('TRACE_NOT_FOUND');
    visited.add(selectedRoot.spanId);
    const ancestor = spansById.get(selectedRoot.parentSpanId);
    if (!ancestor) missingAnchor('TRACE_NOT_FOUND');
    selectedRoot = ancestor;
  }
  const parent = target.parentSpanId == null ? undefined : spansById.get(target.parentSpanId);
  // Null out absent fields so caller-supplied context cannot survive resolution.
  const context = contextSchema.parse(Object.fromEntries(Object.keys(contextFields).map(key => [key, null])));
  return {
    ...context,
    ...contextSchema.parse(target),
    executionSource: target.source ?? null,
    tags: selectedRoot.tags ?? null,
    rootEntityType: selectedRoot.entityType ?? null,
    rootEntityId: selectedRoot.entityId ?? null,
    rootEntityName: selectedRoot.entityName ?? null,
    rootEntityVersionId: selectedRoot.entityVersionId ?? null,
    parentEntityType: parent?.entityType ?? target.parentEntityType ?? null,
    parentEntityId: parent?.entityId ?? target.parentEntityId ?? null,
    parentEntityName: parent?.entityName ?? target.parentEntityName ?? null,
    parentEntityVersionId: parent?.entityVersionId ?? target.parentEntityVersionId ?? null,
    ...scope,
    // Like buildRecordedScoreEventFromTrace/buildRecordedFeedbackEventFromTrace,
    // inherit target-span metadata and let caller metadata override matching keys.
    metadata: { ...target.metadata, ...record.metadata },
  };
}
