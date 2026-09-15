import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

import type { SearchableSpan } from '../../../types';
import { toSearchableSpans } from '../../../utils';

// Bind the fixture to the live wire contract: the trace panel renders the
// lightweight spans returned by `client.getTraceLight`, so we derive the span
// shape from the client method rather than the component prop type.
type GetTraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;
type TraceSpan = GetTraceLightResponse['spans'][number];

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

// The panel receives spans already enriched, exactly as the query hooks deliver
// them: `useTraceLightSpans` and `useBranch` run `selectSearchableSpans` on
// resolution. Building the fixtures the same way keeps them faithful to that.
export const rootSpanFixture: SearchableSpan[] = toSearchableSpans([rootSpan]);

export const nestedSpanFixture: SearchableSpan[] = toSearchableSpans([rootSpan, childSpan]);

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

export const deepTraceFixture: SearchableSpan[] = toSearchableSpans([
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
]);
