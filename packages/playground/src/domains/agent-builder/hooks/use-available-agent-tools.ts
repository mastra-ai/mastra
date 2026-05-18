import { useMemo } from 'react';
import { useBuilderPickerVisibility } from '../../builder';
import { useAllIntegrationTools } from '../../tool-integrations/hooks';
import { buildAvailableToolRecords } from '../mappers/build-available-tool-records';
import type { AgentBuilderEditFormValues } from '../schemas';
import { buildAgentTools } from '../types/agent-tool';
import type { AgentTool, SelectedIntegrationTool } from '../types/agent-tool';

interface UseAvailableAgentToolsArgs {
  toolsData: Record<string, unknown>;
  agentsData: Record<string, unknown>;
  workflowsData?: Record<string, unknown>;
  selectedTools: Record<string, boolean> | undefined;
  selectedAgents: Record<string, boolean> | undefined;
  selectedWorkflows?: Record<string, boolean> | undefined;
  toolIntegrations?: AgentBuilderEditFormValues['toolIntegrations'];
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
  toolIntegrations,
  excludeAgentId,
}: UseAvailableAgentToolsArgs): AgentTool[] {
  const resolvedWorkflowsData = workflowsData ?? EMPTY_RECORD;
  const picker = useBuilderPickerVisibility();
  const { tools: availableIntegrationTools } = useAllIntegrationTools();

  return useMemo(() => {
    const filteredTools = picker.visibleTools === null ? toolsData : filterByAllowlist(toolsData, picker.visibleTools);
    const filteredAgents =
      picker.visibleAgents === null ? agentsData : filterByAllowlist(agentsData, picker.visibleAgents);
    const filteredWorkflows =
      picker.visibleWorkflows === null
        ? resolvedWorkflowsData
        : filterByAllowlist(resolvedWorkflowsData, picker.visibleWorkflows);

    // Union of provider-allowed tools and currently-selected tools. The
    // server caps `allowedToolServices`, so this list is bounded and stable
    // for rendering inline.
    const integrationToolsById = new Map<string, SelectedIntegrationTool>();
    for (const available of availableIntegrationTools) {
      const key = `${available.providerId}:${available.slug}`;
      integrationToolsById.set(key, {
        providerId: available.providerId,
        slug: available.slug,
        toolService: available.toolService,
        description: available.description,
      });
    }
    if (toolIntegrations) {
      for (const [providerId, config] of Object.entries(toolIntegrations)) {
        if (!config?.tools) continue;
        for (const [slug, entry] of Object.entries(config.tools)) {
          if (!entry) continue;
          const key = `${providerId}:${slug}`;
          // Selected entries override the catalog so we never drop a saved
          // tool the catalog can't list right now.
          integrationToolsById.set(key, {
            providerId,
            toolService: entry.toolService,
            slug,
            description: entry.description,
          });
        }
      }
    }
    const integrationTools = Array.from(integrationToolsById.values());

    // Build the `selected` set for integrations from form state so the UI
    // can show a checkbox per tool.
    const selectedIntegrationIds = new Set<string>();
    if (toolIntegrations) {
      for (const [providerId, config] of Object.entries(toolIntegrations)) {
        if (!config?.tools) continue;
        for (const slug of Object.keys(config.tools)) {
          selectedIntegrationIds.add(`${providerId}:${slug}`);
        }
      }
    }

    const records = buildAvailableToolRecords(filteredTools, filteredAgents, filteredWorkflows, excludeAgentId);
    return buildAgentTools({
      tools: records.tools,
      agents: records.agents,
      workflows: records.workflows,
      selected: { tools: selectedTools, agents: selectedAgents, workflows: selectedWorkflows },
      integrationTools,
      selectedIntegrationIds,
    });
  }, [
    toolsData,
    agentsData,
    resolvedWorkflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    toolIntegrations,
    excludeAgentId,
    picker,
    availableIntegrationTools,
  ]);
}
