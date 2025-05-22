import { client } from '@/lib/client';

import { RuntimeContext } from '@mastra/core/di';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

export interface ExecuteToolInput {
  agentId: string;
  toolId: string;
  input: any;
  playgroundRuntimeContext?: Record<string, any>;
}

export const useExecuteTool = () => {
  return useMutation({
    mutationFn: async ({ agentId, toolId, input, playgroundRuntimeContext }: ExecuteToolInput) => {
      const runtimeContext = new RuntimeContext();
      Object.entries(playgroundRuntimeContext ?? {}).forEach(([key, value]) => {
        runtimeContext.set(key, value);
      });
      try {
        const agent = client.getAgent(agentId);
        const response = await agent.executeTool(toolId, { data: input, runtimeContext });

        return response;
      } catch (error) {
        toast.error('Error executing agent tool');
        console.error('Error executing tool:', error);
        throw error;
      }
    },
  });
};
