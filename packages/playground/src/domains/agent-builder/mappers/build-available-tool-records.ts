import type { AvailableAgentsRecord, AvailableToolsRecord, AvailableWorkflowsRecord } from '../types/agent-tool';

// Built-in agents that should never appear in the Agent Builder picker.
const HIDDEN_AGENT_IDS = new Set(['builder-agent']);

interface BuildAvailableToolRecordsResult {
  tools: AvailableToolsRecord;
  agents: AvailableAgentsRecord;
  workflows: AvailableWorkflowsRecord;
}

export function buildAvailableToolRecords(
  toolsData: Record<string, unknown>,
  agentsData: Record<string, unknown>,
  workflowsData: Record<string, unknown> = {},
  excludeAgentId?: string,
): BuildAvailableToolRecordsResult {
  const tools: AvailableToolsRecord = Object.fromEntries(
    Object.entries(toolsData).map(([toolId, tool]) => [
      toolId,
      { description: (tool as { description?: string }).description },
    ]),
  );

  const agents: AvailableAgentsRecord = Object.fromEntries(
    Object.entries(agentsData)
      .filter(([agentId]) => agentId !== excludeAgentId && !HIDDEN_AGENT_IDS.has(agentId))
      .map(([agentId, agent]) => [
        agentId,
        {
          id: agentId,
          name: (agent as { name?: string }).name ?? agentId,
          description: (agent as { description?: string }).description,
        },
      ]),
  );

  const workflows: AvailableWorkflowsRecord = Object.fromEntries(
    Object.entries(workflowsData).map(([workflowId, workflow]) => [
      workflowId,
      {
        id: workflowId,
        name: (workflow as { name?: string }).name ?? workflowId,
        description: (workflow as { description?: string }).description,
      },
    ]),
  );

  return { tools, agents, workflows };
}
