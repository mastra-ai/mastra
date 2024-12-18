import { Tool } from '@mastra/core';
import { useState } from 'react';

import { useAgents } from './use-agents';

export const useAgentTools = () => {
  const { agents, isLoading } = useAgents();
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  const tools = Object.values(agents).reduce<Record<string, Tool<any, any, any, any>>>((acc, agent) => {
    return {
      ...acc,
      ...agent.tools,
    };
  }, {});

  const executeTool = async ({ agentId, toolId, input }: { agentId: string; toolId: string; input: any }) => {
    try {
      setIsExecutingTool(true);
      const response = await fetch(`/api/agents/${agentId}/tools/${toolId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Error executing tool: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing tool:', error);
      throw error;
    } finally {
      setIsExecutingTool(false);
    }
  };

  return { tools, isLoading, executeTool, isExecutingTool };
};
