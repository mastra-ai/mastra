import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const observationalMemoryQueryKey = (agentId: string | undefined, threadId: string | undefined) =>
  ['memory', 'observational-memory', agentId, threadId] as const;

type ObservationalMemoryResponse = Awaited<ReturnType<MastraClient['getObservationalMemory']>>;

export function useObservationalMemory<TData = ObservationalMemoryResponse>({
  agentId,
  threadId,
  resourceId,
  queryOptions,
}: {
  agentId: string | undefined;
  threadId: string | undefined;
  resourceId?: string;
  queryOptions?: MastraQueryOptions<ObservationalMemoryResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: observationalMemoryQueryKey(agentId, threadId),
    queryFn:
      agentId && threadId
        ? () =>
            client.getObservationalMemory({
              agentId,
              threadId,
              resourceId,
            })
        : skipToken,
    // The record is read by several surfaces at once (collapsed memory bar, OM
    // section, detail panel). A short stale window lets a newly mounted consumer
    // reuse the cached record instead of refiring the request; freshness still
    // comes from the explicit refetch on stream finish/observation signals.
    staleTime: 5_000,
    ...queryOptions,
  });
}
