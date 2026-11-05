import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const observationalMemoryContextQueryKey = (agentId: string | undefined, threadId: string | undefined) =>
  ['memory', 'observational-memory', 'context', agentId, threadId] as const;

type ObservationalMemoryContextResponse = Awaited<ReturnType<MastraClient['getObservationalMemoryContext']>>;

/** What observational memory sends the model on the thread's next turn. */
export function useObservationalMemoryContext<TData = ObservationalMemoryContextResponse>({
  agentId,
  threadId,
  resourceId,
  queryOptions,
}: {
  agentId: string | undefined;
  threadId: string | undefined;
  resourceId?: string;
  queryOptions?: MastraQueryOptions<ObservationalMemoryContextResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: observationalMemoryContextQueryKey(agentId, threadId),
    queryFn:
      agentId && threadId ? () => client.getObservationalMemoryContext({ agentId, threadId, resourceId }) : skipToken,
    ...queryOptions,
  });
}
