import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export const TRACE_ID = 'trace-panel';

const baseSpan = {
  traceId: TRACE_ID,
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-08-30T12:00:00.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.000Z'),
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const rootSpan = {
  ...baseSpan,
  spanId: 'span-root',
  name: 'Root agent run',
  parentSpanId: null,
  entityType: 'agent',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
};
export const childSpanOne = {
  ...baseSpan,
  spanId: 'span-child-1',
  name: 'First tool call',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: 'span-root',
};
export const childSpanTwo = {
  ...baseSpan,
  spanId: 'span-child-2',
  name: 'Second tool call',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: 'span-root',
};

/** Full trace tree: root with two children — enough to exercise prev/next span navigation. */
export const panelTraceSpans: GetTraceResponse = {
  traceId: TRACE_ID,
  spans: [rootSpan, childSpanOne, childSpanTwo],
};

export const spanDetailById: Record<string, GetSpanResponse> = {
  'span-root': { span: { ...rootSpan, input: { message: 'go' }, output: { text: 'done' } } },
  'span-child-1': { span: { ...childSpanOne, input: { arg: 1 }, output: { ok: true } } },
  'span-child-2': { span: { ...childSpanTwo, input: { arg: 2 }, output: { ok: true } } },
};
