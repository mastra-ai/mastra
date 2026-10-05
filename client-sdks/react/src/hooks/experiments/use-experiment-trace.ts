import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type TraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useExperimentTrace = <TData = TraceLightResponse>({
  traceId,
  queryOptions,
}: {
  traceId: string | null | undefined;
  queryOptions?: MastraQueryOptions<TraceLightResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-trace-light', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      return client.getTraceLight(traceId);
    },
    ...queryOptions,
  });
};
