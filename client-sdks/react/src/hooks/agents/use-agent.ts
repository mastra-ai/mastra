import type { UseQueryResult } from '@tanstack/react-query';
import type { GetAgentResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useAgent = <TData = GetAgentResponse | null>({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<GetAgentResponse | null, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    ...queryOptions,
  });
};
