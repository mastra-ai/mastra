import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

export const RUN_TRACE_ID = 'run-trace-1';

const recordedSpan = {
  traceId: RUN_TRACE_ID,
  isEvent: false,
  startedAt: new Date('2026-10-08T18:07:17.000Z'),
  endedAt: new Date('2026-10-08T18:07:19.000Z'),
  createdAt: new Date('2026-10-08T18:07:17.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const recordedRunTrace: GetTraceResponse = {
  traceId: RUN_TRACE_ID,
  spans: [
    {
      ...recordedSpan,
      spanId: 'span-run',
      name: "agent run: 'helper'",
      spanType: SpanType.AGENT_RUN,
      parentSpanId: null,
    },
    {
      ...recordedSpan,
      spanId: 'span-model',
      name: "llm: 'gpt-5.4-mini'",
      spanType: SpanType.MODEL_GENERATION,
      parentSpanId: 'span-run',
    },
  ],
};
