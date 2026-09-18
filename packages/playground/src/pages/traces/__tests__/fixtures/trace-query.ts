import type { TraceQueryTraceResponse } from '@mastra/client-js';

export const traceQueryPage: Extract<TraceQueryTraceResponse, { page: { next: string | null } }> = {
  traces: [
    {
      traceId: 'trace-a',
      rootSpanId: 'span-a',
      name: 'Studio preview agent',
      createdAt: '2026-09-15T12:00:00.000Z',
      startedAt: '2026-09-15T12:00:00.000Z',
      endedAt: '2026-09-15T12:00:01.000Z',
      status: 'success',
      entityId: null,
      entityName: null,
      entityType: null,
      environment: null,
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
      threadId: null,
      resourceId: null,
    },
  ],
  page: { next: null },
};
