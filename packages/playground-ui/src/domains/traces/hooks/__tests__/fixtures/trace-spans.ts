import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

type TraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

const rootSpan: TraceResponse['spans'][number] = {
  traceId: 'resumed-trace',
  spanId: 'root',
  parentSpanId: null,
  name: 'agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-09-02T19:13:00Z'),
  endedAt: new Date('2026-09-02T19:14:00Z'),
  createdAt: new Date('2026-09-02T19:13:00Z'),
  updatedAt: null,
};

export const runningTrace: TraceResponse = { traceId: rootSpan.traceId, spans: [{ ...rootSpan, endedAt: null }] };
export const suspendedTrace: TraceResponse = { traceId: rootSpan.traceId, spans: [rootSpan] };
export const resumedTrace: TraceResponse = {
  traceId: rootSpan.traceId,
  spans: [
    rootSpan,
    {
      ...rootSpan,
      spanId: 'resumed',
      parentSpanId: rootSpan.spanId,
      name: 'agent run (resumed)',
      startedAt: new Date('2026-09-02T19:15:00Z'),
      endedAt: new Date('2026-09-02T19:16:00Z'),
    },
  ],
};
export const emptyTrace: TraceResponse = { traceId: rootSpan.traceId, spans: [] };
export const otherTrace: TraceResponse = { traceId: 'other', spans: [] };
