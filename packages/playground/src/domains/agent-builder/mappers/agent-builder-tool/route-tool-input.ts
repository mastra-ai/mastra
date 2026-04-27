import type { AgentTool } from '../../types/agent-tool';

export interface ToolInputEntry {
  id: string;
  name: string;
}

export interface RoutedToolInput {
  tools: Record<string, true>;
  agents: Record<string, true>;
}

export function routeToolInputToFormKeys(
  availableAgentTools: AgentTool[],
  inputTools: ToolInputEntry[],
): RoutedToolInput {
  const typeById = new Map(availableAgentTools.map(item => [item.id, item.type] as const));
  const tools: Record<string, true> = {};
  const agents: Record<string, true> = {};

  for (const entry of inputTools) {
    const type = typeById.get(entry.id);
    if (type === 'agent') {
      agents[entry.id] = true;
    } else {
      tools[entry.id] = true;
    }
  }

  return { tools, agents };
}
