import { useAgents } from '@mastra/react/hooks';

export interface ToolAgent {
  id: string;
  name: string;
}

/** Agents that have this tool, with `currentAgentId` (the agent the page was opened from) first. */
export function useToolAgents(toolId: string, currentAgentId?: string) {
  const { data: agents = {}, isLoading, isError } = useAgents();

  const toolAgents: ToolAgent[] = Object.entries(agents)
    .filter(([, agent]) => Object.values(agent.tools ?? {}).some(tool => tool.id === toolId))
    .map(([id, agent]) => ({ id, name: agent.name || id }));

  const sortedAgents = [
    ...toolAgents.filter(agent => agent.id === currentAgentId),
    ...toolAgents.filter(agent => agent.id !== currentAgentId),
  ];

  return { agents: sortedAgents, isLoading, isError };
}
