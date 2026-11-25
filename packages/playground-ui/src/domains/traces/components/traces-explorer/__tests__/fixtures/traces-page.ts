import type { MastraClient, TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import { basicAgentTrace, TRACE_THREAD_ID, TRACE_THREAD_ITEM_ID } from '../../../__tests__/fixtures/trace-thread-item';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

export { TRACE_THREAD_ID, TRACE_THREAD_ITEM_ID };

/** The travel agent's turn, as `getTrace` returns it: a root agent run on a thread. */
export const travelTrace: GetTraceResponse = basicAgentTrace;

const travelRow: TraceQueryKeysetTraceResponse['traces'][number] = {
  traceId: TRACE_THREAD_ITEM_ID,
  rootSpanId: 'agent-root',
  name: 'Travel agent run',
  createdAt: '2026-08-30T12:00:00.000Z',
  startedAt: '2026-08-30T12:00:00.000Z',
  endedAt: '2026-08-30T12:00:01.000Z',
  status: 'success',
  entityId: 'travel-agent',
  entityName: 'Travel Agent',
  entityType: 'agent',
  environment: null,
  parentSpanId: null,
  metadata: null,
  inputPreview: 'Plan a weekend in Paris',
  outputPreview: 'Your Paris itinerary is ready.',
  errorPreview: null,
  threadId: TRACE_THREAD_ID,
  resourceId: null,
};

/** Two turns of the travel agent, newest first, as `queryTraces` returns them. */
export const travelTracesPage: TraceQueryKeysetTraceResponse = {
  traces: [
    travelRow,
    {
      ...travelRow,
      traceId: 'trace-hotel',
      rootSpanId: 'hotel-root',
      startedAt: '2026-08-30T11:00:00.000Z',
      createdAt: '2026-08-30T11:00:00.000Z',
      inputPreview: 'Find a hotel near the Louvre',
    },
  ],
  page: { next: 'cursor-page-2' },
};
