import type { AgentTool } from '../../types/agent-tool';

export interface ToolInputEntry {
  id: string;
  name: string;
}

export interface RoutedIntegrationToolRef {
  providerId: string;
  toolService: string;
  slug: string;
  description?: string;
}

export interface RoutedToolInput {
  tools: Record<string, true>;
  agents: Record<string, true>;
  workflows: Record<string, true>;
  integrationTools: RoutedIntegrationToolRef[];
}

export function routeToolInputToFormKeys(
  availableAgentTools: AgentTool[],
  inputTools: ToolInputEntry[],
): RoutedToolInput {
  const byId = new Map(availableAgentTools.map(item => [item.id, item] as const));
  const tools: Record<string, true> = {};
  const agents: Record<string, true> = {};
  const workflows: Record<string, true> = {};
  const integrationTools: RoutedIntegrationToolRef[] = [];

  for (const entry of inputTools) {
    const item = byId.get(entry.id);
    if (!item) continue;
    if (item.type === 'agent') {
      agents[entry.id] = true;
    } else if (item.type === 'workflow') {
      workflows[entry.id] = true;
    } else if (item.type === 'integration') {
      if (item.providerId && item.toolService) {
        integrationTools.push({
          providerId: item.providerId,
          toolService: item.toolService,
          slug: item.name,
          description: item.description,
        });
      }
    } else if (item.type === 'tool') {
      tools[entry.id] = true;
    }
  }

  return { tools, agents, workflows, integrationTools };
}
