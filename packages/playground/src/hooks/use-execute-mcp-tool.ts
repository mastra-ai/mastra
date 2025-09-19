import { client } from '@/lib/client';
import { RuntimeContext } from '@mastra/core/di';

import { useState } from 'react';
import { toast } from 'sonner';

export const useExecuteTool = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeTool = async ({
    serverId,
    toolId,
    input,
    runtimeContext: playgroundRuntimeContext,
  }: {
    serverId: string;
    toolId: string;
    input: any;
    runtimeContext?: Record<string, any>;
  }) => {
    const runtimeContext = new RuntimeContext();
    Object.entries(playgroundRuntimeContext ?? {}).forEach(([key, value]) => {
      runtimeContext.set(key, value);
    });

    try {
      setIsExecuting(true);
      const tool = client.getMcpServerTool(serverId, toolId);
      const response = await tool.execute({ data: input, runtimeContext });

      return response;
    } catch (error) {
      toast.error('Error executing MCP tool');
      console.error('Error executing MCP tool:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  return { executeTool, isExecuting };
};
