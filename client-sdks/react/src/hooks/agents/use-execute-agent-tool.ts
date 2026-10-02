import { RequestContext } from '@mastra/core/di';
import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export interface ExecuteToolInput {
  agentId: string;
  toolId: string;
  input: any;
  playgroundRequestContext?: Record<string, any>;
}

export const useExecuteAgentTool = () => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ agentId, toolId, input, playgroundRequestContext }: ExecuteToolInput) => {
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext ?? {}).forEach(([key, value]) => {
        requestContext.set(key, value);
      });
      return client.getAgent(agentId).executeTool(toolId, { data: input, requestContext });
    },
  });
};
