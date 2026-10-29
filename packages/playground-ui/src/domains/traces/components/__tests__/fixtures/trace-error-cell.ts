import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export const FAILED_TRACE_ID = 'trace-failed';
export const FAILED_SPAN_ID = 'span-failed';

export const fullErrorMessage =
  'This request requires more credits, or fewer max_tokens. You requested up to 64000 tokens, but can only afford 21837. To increase, visit https://openrouter.ai/settings/credits and upgrade to a paid account';

/** What the trace list stores for the row: the first 100 characters of the error. */
export const errorPreview = `${fullErrorMessage.slice(0, 100)}…`;

export const failedSpanDetail: GetSpanResponse = {
  span: {
    traceId: FAILED_TRACE_ID,
    spanId: FAILED_SPAN_ID,
    parentSpanId: null,
    name: "agent run: 'chef-agent'",
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    status: TraceStatus.ERROR,
    startedAt: new Date('2026-10-16T11:20:52.000Z'),
    endedAt: new Date('2026-10-16T11:20:53.000Z'),
    createdAt: new Date('2026-10-16T11:20:52.000Z'),
    updatedAt: null,
    error: { name: 'AI_APICallError', message: fullErrorMessage },
  },
};
