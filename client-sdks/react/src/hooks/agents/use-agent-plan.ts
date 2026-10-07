import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type AgentPlanResponse = Awaited<ReturnType<ReturnType<MastraClient['getAgent']>['readPlan']>>;

interface UseAgentPlanOptions<TData> {
  agentId: string;
  path: string;
  agentVersionId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<AgentPlanResponse, TData>;
}

export function useAgentPlan<TData = AgentPlanResponse>({
  agentId,
  path,
  agentVersionId,
  requestContext,
  queryOptions,
}: UseAgentPlanOptions<TData>): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent-plan', agentId, agentVersionId, path, requestContext],
    queryFn: () => {
      const agent = agentVersionId ? client.getAgent(agentId, { versionId: agentVersionId }) : client.getAgent(agentId);
      return agent.readPlan(path, requestContext);
    },
    retry: false,
    ...queryOptions,
  });
}
