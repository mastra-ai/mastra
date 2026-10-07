import { MastraClient } from '@mastra/client-js';
import type { TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

/** Turns fetched per thread to build its summary. Threads with more turns report `hasMoreTurns`. */
const SUMMARY_TURN_LIMIT = 100;

export interface TraceThreadSummary {
  threadId: string;
  turnCount: number;
  hasMoreTurns: boolean;
  firstInput: string | null;
  lastInput: string | null;
  entityName: string | null;
  entityType: string | null;
  resourceId: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  errorCount: number;
}

export function summarizeThreadTraces(threadId: string, response: TraceQueryKeysetTraceResponse): TraceThreadSummary {
  const traces = response.traces;
  const first = traces[0];
  const last = traces[traces.length - 1];
  return {
    threadId,
    turnCount: traces.length,
    hasMoreTurns: response.page.next != null,
    firstInput: first?.inputPreview ?? null,
    lastInput: last?.inputPreview ?? null,
    entityName: first?.entityName ?? null,
    entityType: first?.entityType ?? null,
    resourceId: first?.resourceId ?? null,
    startedAt: first?.startedAt ?? null,
    lastActivityAt: last?.endedAt ?? last?.startedAt ?? null,
    errorCount: traces.filter(trace => trace.status === 'error').length,
  };
}

/**
 * Builds a thread row from its traces, oldest first. The thread-query API returns ids only,
 * so each row fetches its own traces (one request per visible thread).
 */
export function useTraceThreadSummary({
  threadId,
  timeRange,
  enabled = true,
}: {
  threadId: string;
  timeRange: { from: string; to: string };
  enabled?: boolean;
}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['trace-thread-summary', threadId, timeRange] as const,
    queryFn: async () => {
      const queryClient = new MastraClient({ ...client.options, retries: 0 });
      const response = await queryClient.queryTraces({
        timeRange,
        where: { op: 'eq', left: { path: 'threadId' }, right: { literal: threadId } },
        orderBy: [{ field: 'startedAt', direction: 'asc' }],
        page: { limit: SUMMARY_TURN_LIMIT, after: null },
      });
      if (!('traces' in response && 'page' in response))
        throw new Error('Expected a cursor-paginated trace query response');
      return summarizeThreadTraces(threadId, response);
    },
    staleTime: 30_000,
    enabled,
  });
}
