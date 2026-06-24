import { SpanType } from '@mastra/core/observability';

import type { TraceDataPanelViewProps } from '../../trace-data-panel-view';

type Spans = NonNullable<TraceDataPanelViewProps['spans']>;
type TraceSpan = Spans[number];

// One root span so the panel renders the actions row (the button is gated on
// `hierarchicalSpans.length > 0`). Fully typed against the component's `spans`
// prop so no cast is needed — the timeline reads these fields directly.
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

export const rootSpanFixture: Spans = [rootSpan];
