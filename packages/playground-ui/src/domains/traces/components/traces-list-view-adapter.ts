import type { TraceQueryTrace } from '@mastra/core/storage';
import { displayTraceName } from '../trace-list-columns';
import type { TracesListViewTrace } from './traces-list-view';

export function toTracesListViewTraces(traces: TraceQueryTrace[]): TracesListViewTrace[] {
  return traces.map(trace => ({
    traceId: trace.traceId,
    spanId: trace.rootSpanId,
    parentSpanId: trace.parentSpanId,
    name: displayTraceName(trace.name),
    createdAt: trace.createdAt,
    inputPreview: trace.inputPreview,
    metadata: trace.metadata,
    entityId: trace.entityId,
    entityName: trace.entityName,
    entityType: trace.entityType,
    status: trace.status,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
  }));
}
