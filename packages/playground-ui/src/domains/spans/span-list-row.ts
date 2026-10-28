import type { SpanRow } from '@mastra/react/hooks/traces';
import type { TracesListViewTrace } from '@/domains/traces/components/traces-list-view';

// `entityName` is left out: the list's Name column prefers it over `name`, which would label every
// span of an agent with the agent's name instead of the span's own name.
export function spanToListRow(span: SpanRow): TracesListViewTrace {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    entityType: span.entityType,
    entityId: span.entityId,
    threadId: span.threadId,
    resourceId: span.resourceId,
    environment: span.environment,
    model: span.model,
    provider: span.provider,
    status: span.status,
    inputPreview: span.inputPreview,
    outputPreview: span.outputPreview ?? undefined,
    errorPreview: span.errorPreview ?? undefined,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    createdAt: span.startedAt,
  };
}
