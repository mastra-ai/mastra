import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

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

export const rootSpanFixture: TraceSpan[] = [rootSpan];
