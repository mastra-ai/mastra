import type { TraceQueryTraceResponse } from '@mastra/client-js';

type TraceQueryResponse = Extract<TraceQueryTraceResponse, { page: { next: string | null } }>;

export const firstTraceQueryPage: TraceQueryResponse = {
  traces: [
    {
      traceId: 'trace-a',
      rootSpanId: 'span-a',
      name: 'Agent run',
      entityId: null,
      parentSpanId: null,
      createdAt: '2026-09-01T10:00:00Z',
      metadata: null,
      inputPreview: null,
      threadId: null,
      resourceId: null,
      startedAt: '2026-09-01T10:00:00Z',
      endedAt: '2026-09-01T10:01:00Z',
      entityName: 'assistant',
      entityType: 'agent',
      environment: null,
      status: 'success',
    },
  ],
  page: { next: 'cursor-a' },
};

export const lastTraceQueryPage: TraceQueryResponse = {
  traces: firstTraceQueryPage.traces.map(trace => ({ ...trace, traceId: 'trace-b', rootSpanId: 'span-b' })),
  page: { next: null },
};
