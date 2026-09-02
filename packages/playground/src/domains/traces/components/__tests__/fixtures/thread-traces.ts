import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;
type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

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

export const traceASpans: GetTraceResponse = {
  traceId: 'trace-a',
  spans: [{ ...baseTrace, parentSpanId: null }],
};

export const traceBSpans: GetTraceResponse = {
  traceId: 'trace-b',
  spans: [{ ...threadTracesList.spans[1], parentSpanId: null }],
};

export const spanADetail: GetSpanResponse = {
  span: { ...baseTrace, parentSpanId: null, input: { message: 'cook pasta' }, output: { text: 'carbonara' } },
};
