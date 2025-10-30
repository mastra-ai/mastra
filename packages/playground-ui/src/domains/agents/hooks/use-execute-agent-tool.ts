import { RequestContext } from '@mastra/core/di';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

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
      try {
        const agent = client.getAgent(agentId);
        const response = await agent.executeTool(toolId, { data: input, requestContext });

        return response;
      } catch (error) {
        toast.error('Error executing agent tool');
        console.error('Error executing tool:', error);
        throw error;
      }
    },
  });
};
