import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseAgentPlanOptions {
  agentId: string;
  path: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
}

type SubmitPlanToolId = (typeof import('@mastra/core/tools'))['submitPlanTool']['id'];

// Keep the browser bundle free of the Node-oriented tool implementation while
// retaining a compile-time link to the literal ID exported by @mastra/core.
export const SUBMIT_PLAN_TOOL_ID: SubmitPlanToolId = 'submit_plan';

export function useAgentPlanToolNames({
  agentId,
  agentVersionId,
  requestContext,
}: Omit<UseAgentPlanOptions, 'path'>) {
  const client = useMastraClient();

  return useQuery({
    queryKey: agentVersionId
      ? ['agent', agentId, requestContext, { versionId: agentVersionId }]
      : ['agent', agentId, requestContext],
    queryFn: () => {
      const agent = agentVersionId ? client.getAgent(agentId, { versionId: agentVersionId }) : client.getAgent(agentId);
      return agent.details(requestContext);
    },
    select: agent =>
      Object.entries(agent.tools ?? {})
        .filter(([, tool]) => tool.id === SUBMIT_PLAN_TOOL_ID)
        .map(([toolName]) => toolName),
    retry: false,
  });
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
