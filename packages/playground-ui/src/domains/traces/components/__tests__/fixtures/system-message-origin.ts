import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import type { ModelStepMessage } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export const ORIGIN_TRACE_ID = 'trace-origin';

const baseSpan = {
  traceId: ORIGIN_TRACE_ID,
  isEvent: false,
  startedAt: new Date('2026-08-30T12:00:00.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.000Z'),
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

const agentRunSpan = {
  ...baseSpan,
  spanId: 'agent01',
  name: "agent run: 'origin-agent'",
  spanType: SpanType.AGENT_RUN,
  parentSpanId: null,
  entityType: 'agent',
  entityId: 'origin-agent',
  entityName: 'Origin Agent',
};
const processorSpan = {
  ...baseSpan,
  spanId: 'proc01',
  name: 'input processor: injector',
  spanType: SpanType.PROCESSOR_RUN,
  parentSpanId: 'agent01',
};
const inferenceSpan = {
  ...baseSpan,
  spanId: 'infer1',
  name: "llm: 'mock-model-id'",
  spanType: SpanType.MODEL_INFERENCE,
  parentSpanId: 'agent01',
};

const inferenceInput: ModelStepMessage[] = [
  { role: 'system', content: 'Base instructions', spanId: 'agent01' },
  { role: 'system', content: 'Injected by processor', spanId: 'proc01' },
  // Added by a span the trace did not export (e.g. an internal span).
  { role: 'system', content: 'Added by an unexported span', spanId: 'gone01' },
  // Rewritten at request time: no origin.
  { role: 'system', content: 'Rewritten at request time' },
  { role: 'user', content: 'Hello' },
];

export const originTraceSpans: GetTraceResponse = {
  traceId: ORIGIN_TRACE_ID,
  spans: [agentRunSpan, processorSpan, inferenceSpan],
};

export const originSpanDetailById: Record<string, GetSpanResponse> = {
  agent01: { span: { ...agentRunSpan, input: 'Hello', output: { text: 'Hi' } } },
  proc01: { span: { ...processorSpan, input: { processorId: 'injector' } } },
  infer1: { span: { ...inferenceSpan, input: inferenceInput, output: { text: 'Hi' } } },
};
