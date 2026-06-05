import type { AvailableAgentTool, IdNameEntry, RoutedTools } from './types';

/**
 * Route `{ id, name }` selection entries into the three form record keys
 * (`tools`, `agents`, `workflows`) based on each entry's type in the available
 * list. Mirrors the playground's `routeToolInputToFormKeys`. Infra-agnostic:
 * receives `entries` and `availableAgentTools` directly, never a workflow ctx.
 */
export function routeTools(entries: IdNameEntry[], availableAgentTools: AvailableAgentTool[]): RoutedTools {
  const typeById = new Map(availableAgentTools.map(item => [item.id, item.type] as const));

  const tools: Record<string, boolean> = {};
  const agents: Record<string, boolean> = {};
  const workflows: Record<string, boolean> = {};

  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
      continue;
    }
    const type = typeById.get(entry.id);
    if (type === 'agent') {
      agents[entry.id] = true;
    } else if (type === 'workflow') {
      workflows[entry.id] = true;
    } else if (type === 'tool') {
      tools[entry.id] = true;
    }
  }

  return { tools, agents, workflows };
}
