import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

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
  spans: [
    {
      ...baseTrace,
      traceId: 'trace-b',
      spanId: 'span-b',
      name: 'Chef agent follow-up',
      parentSpanId: null,
      startedAt: new Date('2026-08-30T12:05:00.000Z'),
      endedAt: new Date('2026-08-30T12:05:01.000Z'),
      createdAt: new Date('2026-08-30T12:05:00.000Z'),
    },
  ],
};

export const spanADetail: GetSpanResponse = {
  span: { ...baseTrace, parentSpanId: null, input: { message: 'cook pasta' }, output: { text: 'carbonara' } },
};
