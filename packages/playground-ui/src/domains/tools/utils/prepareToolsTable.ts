import { GetAgentResponse, GetToolResponse } from '@mastra/client-js';

export interface ToolWithAgents extends GetToolResponse {
  agents: Array<GetAgentResponse & { id: string }>;
}

export const prepareToolsTable = (
  tools: Record<string, GetToolResponse>,
  agents: Record<string, GetAgentResponse>,
): ToolWithAgents[] => {
  const toolsWithAgents = new Map<string, ToolWithAgents>();
  const agentsKeys = Object.keys(agents);

  // Assemble tools from agents
  for (const k of agentsKeys) {
    const agent = agents[k];
    const agentToolsDict = agent.tools;
    const agentToolsKeys = Object.keys(agentToolsDict);

    for (const key of agentToolsKeys) {
      const tool = agentToolsDict[key];

      if (!toolsWithAgents.has(tool.id)) {
        toolsWithAgents.set(tool.id, {
          ...tool,
          agents: [],
        });
      }

      toolsWithAgents.get(tool.id)!.agents.push({ ...agent, id: k });
    }
  }

  // Assemble discovered tools
  for (const [_, tool] of Object.entries(tools)) {
    if (!toolsWithAgents.has(tool.id)) {
      toolsWithAgents.set(tool.id, {
        ...tool,
        agents: [],
      });
    }
  }

  return Array.from(toolsWithAgents.values());
};
