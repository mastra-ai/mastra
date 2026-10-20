import type { TraceQueryKeysetTraceResponse } from '@mastra/client-js';

export const firstTraceQueryPage: TraceQueryKeysetTraceResponse = {
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

export const lastTraceQueryPage: TraceQueryKeysetTraceResponse = {
  traces: firstTraceQueryPage.traces.map(trace => ({ ...trace, traceId: 'trace-b', rootSpanId: 'span-b' })),
  page: { next: null },
};

const [baseTrace] = firstTraceQueryPage.traces;
if (!baseTrace) throw new Error('Expected a trace fixture');

/** One finished and one failed run, each carrying the server's output and error previews. */
export const tracePreviewsPage: TraceQueryKeysetTraceResponse = {
  traces: [
    {
      ...baseTrace,
      traceId: 'trace-ok',
      rootSpanId: 'span-ok',
      inputPreview: 'What is the weather in Paris?',
      outputPreview: 'Sunny, 24°C',
      errorPreview: null,
      status: 'success',
    },
    {
      ...baseTrace,
      traceId: 'trace-failed',
      rootSpanId: 'span-failed',
      inputPreview: 'Book a table for two',
      outputPreview: 'Let me check availability',
      errorPreview: 'Rate limit exceeded',
      status: 'error',
    },
  ],
  page: { next: null },
};

/** The same runs from a server that predates output and error previews. */
export const tracesWithoutPreviewsPage: TraceQueryKeysetTraceResponse = {
  traces: tracePreviewsPage.traces.map(({ outputPreview: _output, errorPreview: _error, ...trace }) => trace),
  page: { next: null },
};
