import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type TraceTrajectoryResponse = Awaited<ReturnType<MastraClient['getTraceTrajectory']>>;

/**
 * The trace's recorded steps (model calls, tool calls, workflow steps) as a trajectory.
 * Does not guard on an empty id; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useTraceTrajectory<TData = TraceTrajectoryResponse>({
  traceId,
  queryOptions,
}: {
  traceId: string | null | undefined;
  queryOptions?: MastraQueryOptions<TraceTrajectoryResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      return client.getTraceTrajectory(traceId);
    },
    ...queryOptions,
  });
}
