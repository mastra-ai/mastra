import { describe, expect, it } from 'vitest';
import { firstTraceQueryPage } from '../hooks/__tests__/fixtures/trace-query';
import { toTracesListViewTraces } from './traces-list-view-adapter';

describe('toTracesListViewTraces', () => {
  it('maps root identity and preserves list display fields', () => {
    const trace = firstTraceQueryPage.traces[0];
    if (!trace) throw new Error('Expected a trace fixture');
    expect(toTracesListViewTraces([trace])).toEqual([
      {
        traceId: trace.traceId,
        spanId: trace.rootSpanId,
        parentSpanId: trace.parentSpanId,
        name: trace.name,
        createdAt: trace.createdAt,
        inputPreview: trace.inputPreview,
        metadata: trace.metadata,
        entityId: trace.entityId,
        entityName: trace.entityName,
        entityType: trace.entityType,
        status: trace.status,
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
      },
    ]);
  });
});
