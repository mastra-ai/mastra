import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

import type { LightSpanRecord } from '../../../types';

// Bind the fixture to the live wire contract: the trace panel renders the
// lightweight spans returned by `client.getTraceLight`, so we derive the span
// shape from the client method rather than the component prop type.
type GetTraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;
type TraceSpan = GetTraceLightResponse['spans'][number];
type FullTraceSpan = Awaited<ReturnType<MastraClient['getTrace']>>['spans'][number];

// One root span so the panel renders the actions row (the button is gated on
// `hierarchicalSpans.length > 0`). The timeline reads these fields directly.
const rootSpan: TraceSpan = {
  traceId: 'trace-1',
  spanId: 'root',
  parentSpanId: null,
  name: 'agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-06-01T10:00:00.000Z'),
  endedAt: new Date('2026-06-01T10:00:01.000Z'),
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  updatedAt: new Date('2026-06-01T10:00:01.000Z'),
};

// Nested spans only reach the DOM once their parent is expanded, which the
// panel does after its first render.
const childSpan: TraceSpan = {
  ...rootSpan,
  spanId: 'child',
  parentSpanId: 'root',
  name: 'weather tool',
  spanType: SpanType.TOOL_CALL,
};

// The panel receives plain spans, exactly as the query hooks deliver them: the
// search haystack is built inside the panel by `useTraceSearch`.
export const rootSpanFixture: LightSpanRecord[] = [rootSpan];

export const nestedSpanFixture: LightSpanRecord[] = [rootSpan, childSpan];

// A four-level, two-branch trace used by the span-search suite. Every span
// carries a distinct value on a different searchable field so a test can aim at
// one row precisely: `http-1` is only reachable through its `inputPreview`,
// `mem-1` is the only `memory_operation`, and `llm generation` appears on both
// branches so a query can match across them.
const deepSpan = (
  spanId: string,
  parentSpanId: string | null,
  name: string,
  spanType: SpanType,
  offsetMs: number,
  extra: Partial<TraceSpan> = {},
): TraceSpan => ({
  ...rootSpan,
  spanId,
  parentSpanId,
  name,
  spanType,
  // Strictly increasing in tree order so `formatHierarchicalSpans` sorts
  // deterministically.
  startedAt: new Date(new Date('2026-06-01T10:00:00.000Z').getTime() + offsetMs),
  ...extra,
});

export const deepTraceFixture: LightSpanRecord[] = [
  // `entityId` makes the root's identity render in the trace header, which the
  // non-regression test reads to prove the header ignores the search filter.
  deepSpan('root', null, 'agent run', SpanType.AGENT_RUN, 0, {
    entityId: 'weather-agent',
    entityName: 'weather-agent',
  }),
  deepSpan('gen-1', 'root', 'llm generation', SpanType.MODEL_GENERATION, 10, { entityName: 'weather-agent' }),
  deepSpan('tool-1', 'gen-1', 'weather tool', SpanType.TOOL_CALL, 20, { inputPreview: '{"city":"Lyon"}' }),
  deepSpan('http-1', 'tool-1', 'http fetch', SpanType.TOOL_CALL, 30, {
    inputPreview: 'https://api.weather.test/lyon',
  }),
  // `metadata` is an open-ended payload: no fixed list of fields can read it, so
  // it is only reachable through the flattened `searchText`.
  deepSpan('mem-1', 'gen-1', 'memory lookup', SpanType.MEMORY_OPERATION, 40, {
    metadata: { store: { vendor: 'pgvector' } },
  }),
  deepSpan('wf-1', 'root', 'workflow run', SpanType.WORKFLOW_RUN, 50, { entityName: 'report-workflow' }),
  deepSpan('step-1', 'wf-1', 'step normalize', SpanType.WORKFLOW_STEP, 60),
  deepSpan('gen-2', 'wf-1', 'llm generation', SpanType.MODEL_GENERATION, 70, { entityName: 'summarizer' }),
];

// An agent run as `client.getTrace` delivers it: full spans, so the model
// generations carry their `attributes`. The agent calls a sub-agent that runs on
// another model, which must not leak into the root agent's header.
const fullSpan = (
  spanId: string,
  parentSpanId: string | null,
  name: string,
  spanType: SpanType,
  offsetMs: number,
  extra: Partial<FullTraceSpan> = {},
): FullTraceSpan => ({
  ...deepSpan(spanId, parentSpanId, name, spanType, offsetMs),
  ...extra,
});

export const agentWithModelFixture: LightSpanRecord[] = [
  fullSpan('root', null, 'agent run', SpanType.AGENT_RUN, 0, {
    entityId: 'weather-agent',
    entityName: 'weather-agent',
  }),
  fullSpan('sub-agent', 'root', 'sub agent run', SpanType.AGENT_RUN, 10, { entityName: 'research-agent' }),
  fullSpan('sub-gen', 'sub-agent', 'sub llm generation', SpanType.MODEL_GENERATION, 20, {
    attributes: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' },
  }),
  fullSpan('gen-1', 'root', 'llm generation', SpanType.MODEL_GENERATION, 30, {
    attributes: { model: 'gpt-4o', provider: 'openai' },
  }),
  fullSpan('gen-2', 'root', 'llm generation', SpanType.MODEL_GENERATION, 40, {
    attributes: { model: 'gpt-4o-mini', provider: 'openai' },
  }),
];
