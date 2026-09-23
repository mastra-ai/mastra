import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseAgentPlanOptions {
  agentId: string;
  path: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
}

export function useAgentPlan({ agentId, path, agentVersionId, requestContext }: UseAgentPlanOptions) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent-plan', agentId, agentVersionId, path, requestContext],
    queryFn: () => {
      const agent = agentVersionId ? client.getAgent(agentId, { versionId: agentVersionId }) : client.getAgent(agentId);
      return agent.readPlan(path, requestContext);
    },
    retry: false,
  });
}
