import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;
type GetTraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;

export const clinicalRootSpan: GetSpanResponse['span'] = {
  traceId: 'trace-clinical',
  spanId: 'root',
  parentSpanId: null,
  name: 'Clinical diagnosis agent',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-08-21T15:00:00.000Z'),
  endedAt: new Date('2026-08-21T15:00:02.000Z'),
  createdAt: new Date('2026-08-21T15:00:00.000Z'),
  updatedAt: new Date('2026-08-21T15:00:02.000Z'),
  status: TraceStatus.SUCCESS,
  input: [
    {
      role: 'user',
      content: 'A 58-year-old patient has abrupt tearing chest pain radiating to the back.',
    },
  ],
  output: {
    text: '## Leading diagnosis\n\nAcute aortic dissection requires immediate evaluation.',
  },
};

export const clinicalLightSpans: GetTraceLightResponse['spans'] = [
  clinicalRootSpan,
  {
    ...clinicalRootSpan,
    spanId: 'model',
    parentSpanId: 'root',
    name: 'Generate clinical differential',
    spanType: SpanType.MODEL_GENERATION,
  },
  {
    ...clinicalRootSpan,
    spanId: 'tool',
    parentSpanId: 'root',
    name: 'Check urgent red flags',
    spanType: SpanType.TOOL_CALL,
  },
];
