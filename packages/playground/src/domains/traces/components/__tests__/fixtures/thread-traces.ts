import type { MastraClient, TraceQueryTraceResponse } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;
type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export function queryPageFromList(
  list: ListTracesLightResponse,
): Extract<TraceQueryTraceResponse, { page: { next: string | null } }> {
  return {
    traces: [...list.spans]
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map(span => ({
        traceId: span.traceId,
        rootSpanId: span.spanId,
        name: span.name,
        startedAt: new Date(span.startedAt).toISOString(),
        endedAt: span.endedAt ? new Date(span.endedAt).toISOString() : null,
        createdAt: new Date(span.createdAt).toISOString(),
        status: 'success',
        entityId: span.entityId ?? null,
        entityName: span.entityName ?? null,
        entityType: span.entityType ?? null,
        parentSpanId: span.parentSpanId ?? null,
        metadata: span.metadata ?? null,
        inputPreview: span.inputPreview ?? null,
        threadId: span.threadId ?? null,
        resourceId: span.resourceId ?? null,
        environment: span.environment ?? null,
      })),
    page: { next: null },
  };
}

export const THREAD_ID = 'thread-1';

const baseTrace = {
  traceId: 'trace-a',
  spanId: 'span-a',
  name: 'Chef agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  threadId: THREAD_ID,
  startedAt: new Date('2026-08-30T12:00:00.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.000Z'),
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const threadTracesList: ListTracesLightResponse = {
  spans: [
    baseTrace,
    {
      ...baseTrace,
      traceId: 'trace-b',
      spanId: 'span-b',
      name: 'Chef agent follow-up',
      startedAt: new Date('2026-08-30T12:05:00.000Z'),
      endedAt: new Date('2026-08-30T12:05:01.000Z'),
      createdAt: new Date('2026-08-30T12:05:00.000Z'),
    },
  ],
  pagination: { total: 2, page: 0, perPage: 25, hasMore: false },
};

export const emptyThreadTracesList: ListTracesLightResponse = {
  spans: [],
  pagination: { total: 0, page: 0, perPage: 25, hasMore: false },
};

// The full-list endpoint mirrors the light rows; served for the 404/500 fallback path.
export const threadTracesFullList: ListTracesResponse = threadTracesList;
export const emptyThreadTracesFullList: ListTracesResponse = emptyThreadTracesList;

/** A child span of trace-a: the tool call behind the assistant reply. */
export const traceAToolSpan = {
  ...baseTrace,
  spanId: 'span-a-tool',
  name: 'Recipe lookup',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: 'span-a',
};

export const traceASpans: GetTraceResponse = {
  traceId: 'trace-a',
  spans: [
    {
      ...baseTrace,
      parentSpanId: null,
      input: { messages: [{ role: 'user', content: 'cook pasta' }] },
      output: { text: 'carbonara' },
    },
    traceAToolSpan,
  ],
};

export const traceBSpans: GetTraceResponse = {
  traceId: 'trace-b',
  spans: [{ ...threadTracesList.spans[1], parentSpanId: null }],
};

export const spanADetail: GetSpanResponse = {
  span: { ...baseTrace, parentSpanId: null, input: { message: 'cook pasta' }, output: { text: 'carbonara' } },
};
