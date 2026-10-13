import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export function createTraceDetails(input: unknown, output: unknown): GetSpanResponse['span'] {
  const timestamp = new Date('2026-07-16T12:00:00.000Z');

  return {
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'Agent run',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt: timestamp,
    endedAt: timestamp,
    input,
    output,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** A model-generation span nested in trace-1, as `GET /observability/traces/trace-1/spans/span-llm` returns it. */
export const llmSpanResponse: GetSpanResponse = {
  span: {
    ...createTraceDetails([{ role: 'user', content: 'What is the weather in Paris?' }], { text: 'Sunny, 24°C' }),
    spanId: 'span-llm',
    parentSpanId: 'span-1',
    name: "llm: 'gpt-5.4-mini'",
    spanType: SpanType.MODEL_GENERATION,
  },
};
