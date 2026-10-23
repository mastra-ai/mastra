import type { AgentVersionIdentifier, GetAgentResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useAgent = <TData = GetAgentResponse | null>({
  agentId,
  version,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  version?: AgentVersionIdentifier;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<GetAgentResponse | null, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent', agentId, version, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId, version).details(requestContext) : null),
    retry: false,
    ...queryOptions,
  });
};
