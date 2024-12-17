import { Tool } from '@mastra/core';

import { useAgents } from './use-agents';

export const useAgentTools = () => {
  const { agents, isLoading } = useAgents();

  const tools = Object.values(agents).reduce<Record<string, Tool<any, any, any, any>>>((acc, agent) => {
    return {
      ...acc,
      ...agent.getTools(),
    };
  }, {});

  return { tools, isLoading };
};
