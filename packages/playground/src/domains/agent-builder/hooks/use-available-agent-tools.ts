import { useMemo } from 'react';
import { buildAvailableToolRecords } from '../mappers/build-available-tool-records';
import { buildAgentTools } from '../types/agent-tool';
import type { AgentTool } from '../types/agent-tool';

interface UseAvailableAgentToolsArgs {
  toolsData: Record<string, unknown>;
  agentsData: Record<string, unknown>;
  workflowsData?: Record<string, unknown>;
  selectedTools: Record<string, boolean> | undefined;
  selectedAgents: Record<string, boolean> | undefined;
  selectedWorkflows?: Record<string, boolean> | undefined;
  excludeAgentId?: string;
}

const EMPTY_RECORD: Record<string, unknown> = {};

export function useAvailableAgentTools({
  toolsData,
  agentsData,
  workflowsData,
  selectedTools,
  selectedAgents,
  selectedWorkflows,
  excludeAgentId,
}: UseAvailableAgentToolsArgs): AgentTool[] {
  const resolvedWorkflowsData = workflowsData ?? EMPTY_RECORD;
  return useMemo(() => {
    const records = buildAvailableToolRecords(toolsData, agentsData, resolvedWorkflowsData, excludeAgentId);
    return buildAgentTools({
      tools: records.tools,
      agents: records.agents,
      workflows: records.workflows,
      selected: { tools: selectedTools, agents: selectedAgents, workflows: selectedWorkflows },
    });
  }, [toolsData, agentsData, resolvedWorkflowsData, selectedTools, selectedAgents, selectedWorkflows, excludeAgentId]);
}
