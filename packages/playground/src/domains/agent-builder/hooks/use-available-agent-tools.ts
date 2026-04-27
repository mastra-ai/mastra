import { useMemo } from 'react';
import { buildAvailableToolRecords } from '../mappers/build-available-tool-records';
import { buildAgentTools } from '../types/agent-tool';
import type { AgentTool } from '../types/agent-tool';

interface UseAvailableAgentToolsArgs {
  toolsData: Record<string, unknown>;
  agentsData: Record<string, unknown>;
  selectedTools: Record<string, boolean> | undefined;
  selectedAgents: Record<string, boolean> | undefined;
  excludeAgentId?: string;
}

export function useAvailableAgentTools({
  toolsData,
  agentsData,
  selectedTools,
  selectedAgents,
  excludeAgentId,
}: UseAvailableAgentToolsArgs): AgentTool[] {
  return useMemo(() => {
    const records = buildAvailableToolRecords(toolsData, agentsData, excludeAgentId);
    return buildAgentTools({
      tools: records.tools,
      agents: records.agents,
      selected: { tools: selectedTools, agents: selectedAgents },
    });
  }, [toolsData, agentsData, selectedTools, selectedAgents, excludeAgentId]);
}
