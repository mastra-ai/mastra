import type { ThreadRow } from '@mastra/react/hooks/traces';
import type { TracesListViewTrace } from '@/domains/traces/components/traces-list-view';

// A thread spans several traces; its latest one keys the row, since it is unique per thread.
export function threadToListRow(thread: ThreadRow): TracesListViewTrace {
  return {
    traceId: thread.lastTraceId,
    name: thread.entityName ?? thread.threadId,
    entityType: thread.entityType,
    entityId: thread.entityId,
    entityName: thread.entityName,
    threadId: thread.threadId,
    resourceId: thread.resourceId,
    environment: thread.environment,
    status: thread.status,
    inputPreview: thread.inputPreview,
    outputPreview: thread.outputPreview ?? undefined,
    errorPreview: thread.errorPreview ?? undefined,
    startedAt: thread.startedAt,
    endedAt: thread.endedAt,
    traceCount: thread.traceCount,
    createdAt: thread.startedAt,
  };
}
