export type AgentToolType = 'tool' | 'agent';

export interface AgentTool {
  id: string;
  name: string;
  description?: string;
  isChecked: boolean;
  type: AgentToolType;
}

export interface AvailableToolsRecord {
  [id: string]: { description?: string };
}

export interface AvailableAgentsRecord {
  [id: string]: { id?: string; name?: string; description?: string };
}

export interface SelectedMaps {
  tools?: Record<string, boolean | undefined>;
  agents?: Record<string, boolean | undefined>;
}

export interface BuildAgentToolsArgs {
  tools: AvailableToolsRecord;
  agents: AvailableAgentsRecord;
  selected?: SelectedMaps;
}

export const buildAgentTools = ({ tools, agents, selected }: BuildAgentToolsArgs): AgentTool[] => {
  const selectedTools = selected?.tools ?? {};
  const selectedAgents = selected?.agents ?? {};

  const result: AgentTool[] = [];
  const seen = new Set<string>();

  for (const [id, agent] of Object.entries(agents)) {
    seen.add(id);
    result.push({
      id,
      name: agent?.name ?? id,
      description: agent?.description,
      isChecked: Boolean(selectedAgents[id]),
      type: 'agent',
    });
  }

  for (const [id, tool] of Object.entries(tools)) {
    if (seen.has(id)) {
      console.warn(
        `[buildAgentTools] id collision for "${id}": agent and tool share the same id; agent takes precedence.`,
      );
      continue;
    }
    seen.add(id);
    result.push({
      id,
      name: id,
      description: tool?.description,
      isChecked: Boolean(selectedTools[id]),
      type: 'tool',
    });
  }

  return result;
};

export interface SplitAgentToolsResult {
  tools: Record<string, true>;
  agents: Record<string, true>;
}

export const splitAgentTools = (items: AgentTool[]): SplitAgentToolsResult => {
  const tools: Record<string, true> = {};
  const agents: Record<string, true> = {};
  for (const item of items) {
    if (!item.isChecked) continue;
    if (item.type === 'agent') {
      agents[item.id] = true;
    } else {
      tools[item.id] = true;
    }
  }
  return { tools, agents };
};
