import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

// Bind the fixture to the live wire contract: the traces list query in
// `SignalDetailsPage` flows through `client.listTraces`, so we derive the
// response shape from the client method rather than re-declaring it inline.
type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type TraceSpan = ListTracesResponse['spans'][number];

const rootSpan: TraceSpan = {
  traceId: 'trace-1',
  spanId: 'span-1',
  name: 'Test trace',
  spanType: SpanType.AGENT_RUN,
  status: TraceStatus.SUCCESS,
  isEvent: false,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const singleTraceResponse: ListTracesResponse = {
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
  spans: [rootSpan],
};
