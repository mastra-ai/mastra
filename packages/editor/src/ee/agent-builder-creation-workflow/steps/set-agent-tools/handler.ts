import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { AvailableAgentTool, IdNameEntry, RoutedTools } from '../../types';

const selectionSchema = z.object({
  ids: z.array(z.string()).describe('Ids of the available tools/agents/workflows the agent should be granted'),
});

/**
 * Select which available tools/agents/workflows the agent should be granted,
 * then route the selected entries into the three form record keys (`tools`,
 * `agents`, `workflows`) based on each entry's type in the available list.
 *
 * The injected `agent` chooses the minimum set from the user-supplied `entries`
 * (constrained to ids that exist in `availableAgentTools`). Routing mirrors the
 * playground's `routeToolInputToFormKeys`.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function routeTools(
  agent: Agent,
  entries: IdNameEntry[],
  availableAgentTools: AvailableAgentTool[],
): Promise<RoutedTools> {
  const typeById = new Map(availableAgentTools.map(item => [item.id, item.type] as const));

  const candidates = entries.filter(
    entry => entry && typeof entry.id === 'string' && entry.id.length > 0 && typeById.has(entry.id),
  );

  const tools: Record<string, boolean> = {};
  const agents: Record<string, boolean> = {};
  const workflows: Record<string, boolean> = {};

  if (candidates.length === 0) {
    return { tools, agents, workflows };
  }

  const result = await agent.generate(
    `Select the minimum set of the following tools/agents/workflows for the agent. ` +
      `Return only ids from this list:\n\n${JSON.stringify(candidates)}`,
    { structuredOutput: { schema: selectionSchema } },
  );

  const selected = new Set(result.object.ids);

  for (const entry of candidates) {
    if (!selected.has(entry.id)) {
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
