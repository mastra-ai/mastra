import { client } from '@/lib/client';
import { useState } from 'react';
import { RuntimeContext } from '@mastra/core/di';
import { toast } from 'sonner';

export const useExecuteTool = () => {
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  const executeTool = async ({
    agentId,
    toolId,
    input,
    runtimeContext: playgroundRuntimeContext,
  }: {
    agentId: string;
    toolId: string;
    input: any;
    runtimeContext?: Record<string, any>;
  }) => {
    const runtimeContext = new RuntimeContext();
    Object.entries(playgroundRuntimeContext ?? {}).forEach(([key, value]) => {
      runtimeContext.set(key, value);
    });
    try {
      setIsExecutingTool(true);
      const agent = client.getAgent(agentId);
      const response = await agent.executeTool(toolId, { data: input, runtimeContext });

      return response;
    } catch (error) {
      toast.error('Error executing agent tool');
      console.error('Error executing tool:', error);
      throw error;
    } finally {
      setIsExecutingTool(false);
    }
  };

  return { executeTool, isExecutingTool };
};
