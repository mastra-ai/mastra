import { useMemo } from 'react';
import { useBuilderPickerVisibility } from '../../builder';
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

function filterByAllowlist<T>(data: Record<string, T>, allowed: Set<string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(data)) {
    // Server normalizes picker IDs to the response keys of each list endpoint,
    // so a direct `Object.keys(data)` match is sufficient.
    if (allowed.has(key)) out[key] = value!;
  }
  return out;
}

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
  const picker = useBuilderPickerVisibility();
  return useMemo(() => {
    const filteredTools = picker.visibleTools === null ? toolsData : filterByAllowlist(toolsData, picker.visibleTools);
    const filteredAgents =
      picker.visibleAgents === null ? agentsData : filterByAllowlist(agentsData, picker.visibleAgents);
    const filteredWorkflows =
      picker.visibleWorkflows === null
        ? resolvedWorkflowsData
        : filterByAllowlist(resolvedWorkflowsData, picker.visibleWorkflows);

    const records = buildAvailableToolRecords(filteredTools, filteredAgents, filteredWorkflows, excludeAgentId);
    return buildAgentTools({
      tools: records.tools,
      agents: records.agents,
      workflows: records.workflows,
      selected: { tools: selectedTools, agents: selectedAgents, workflows: selectedWorkflows },
    });
  }, [
    toolsData,
    agentsData,
    resolvedWorkflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    excludeAgentId,
    picker,
  ]);
}
