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
  threadId: 'weather-thread',
  input: { messages: [{ role: 'user', content: 'Will it rain?' }] },
  output: { text: 'No rain is expected.' },
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

/** Id of the request span outside Mastra (e.g. an OTel HTTP span) that called the agents twice. */
const OUTSIDE_PARENT_SPAN_ID = 'f00dbabe12345678';

const outsideRun = { ...rootSpan, externalParentSpanId: OUTSIDE_PARENT_SPAN_ID };
export const firstOutsideRun = { ...outsideRun, spanId: 'span-run-1', name: 'First agent run' };
export const secondOutsideRun = {
  ...outsideRun,
  spanId: 'span-run-2',
  name: 'Second agent run',
  entityId: 'planner-agent',
  entityName: 'Planner Agent',
  startedAt: new Date('2026-08-30T12:00:02.000Z'),
  endedAt: new Date('2026-08-30T12:00:03.000Z'),
};

/** A root of the same trace with no outside parent, started between the two outside runs. */
export const standaloneRun = {
  ...rootSpan,
  spanId: 'span-standalone',
  name: 'Standalone agent run',
  startedAt: new Date('2026-08-30T12:00:01.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.500Z'),
};

/** One trace, two roots started by the same outside request; the later run is listed first. */
export const outsideRunsTraceSpans: GetTraceResponse = {
  traceId: TRACE_ID,
  spans: [secondOutsideRun, firstOutsideRun],
};

export const spanDetailById: Record<string, GetSpanResponse> = {
  'span-root': { span: { ...rootSpan, input: { message: 'go' }, output: { text: 'done' } } },
  'span-child-1': { span: { ...childSpanOne, sessionId: 'session-42', input: { arg: 1 }, output: { ok: true } } },
  'span-child-2': { span: { ...childSpanTwo, input: { arg: 2 }, output: { ok: true } } },
  'span-run-1': { span: firstOutsideRun },
  'span-run-2': { span: secondOutsideRun },
};
