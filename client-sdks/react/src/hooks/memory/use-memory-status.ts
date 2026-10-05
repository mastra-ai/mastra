import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const memoryStatusQueryKey = (agentId: string | undefined, threadId?: string) =>
  ['memory', 'status', agentId, threadId] as const;

type MemoryStatusResponse = Awaited<ReturnType<MastraClient['getMemoryStatus']>>;

export function useMemoryStatus<TData = MemoryStatusResponse>({
  agentId,
  threadId,
  queryOptions,
}: {
  agentId: string | undefined;
  threadId?: string;
  queryOptions?: MastraQueryOptions<MemoryStatusResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryStatusQueryKey(agentId, threadId),
    queryFn: agentId
      ? () =>
          client.getMemoryStatus(agentId, undefined, {
            threadId,
          })
      : skipToken,
    ...queryOptions,
  });
}
