import type { AgentTool } from '../types/agent-tool';

export interface ToolInputEntry {
  id: string;
  name: string;
}

export interface RoutedToolInput {
  tools: Record<string, true>;
  agents: Record<string, true>;
  workflows: Record<string, true>;
  /**
   * Per-provider integration-tool selections, keyed by `providerId` then by
   * the integration tool `slug`. Mirrors `ToolProvidersFormValue[providerId].tools`
   * so the builder-tool execute can shallow-merge it into form state.
   *
   * `connections` are intentionally omitted — the LLM never selects an
   * authentication connection, so this fragment only ever carries `tools`.
   */
  toolProvidersFragment: Record<string, Record<string, { toolkit: string; description?: string }>>;
}

export function routeToolInputToFormKeys(
  availableAgentTools: AgentTool[],
  inputTools: ToolInputEntry[],
): RoutedToolInput {
  const byId = new Map(availableAgentTools.map(item => [item.id, item] as const));
  const tools: Record<string, true> = {};
  const agents: Record<string, true> = {};
  const workflows: Record<string, true> = {};
  const toolProvidersFragment: Record<string, Record<string, { toolkit: string; description?: string }>> = {};

  for (const entry of inputTools) {
    const item = byId.get(entry.id);
    if (!item) continue;
    if (item.type === 'agent') {
      agents[entry.id] = true;
    } else if (item.type === 'workflow') {
      workflows[entry.id] = true;
    } else if (item.type === 'tool') {
      tools[entry.id] = true;
    } else if (item.type === 'integration' && item.providerId && item.toolkit) {
      // `name` on integration rows is the bare slug (see
      // use-available-agent-tools.ts where rows are built as
      // `{ id: ${providerId}:${slug}, name: slug, ... }`).
      const slug = item.name;
      const bucket = toolProvidersFragment[item.providerId] ?? {};
      bucket[slug] = { toolkit: item.toolkit, ...(item.description ? { description: item.description } : {}) };
      toolProvidersFragment[item.providerId] = bucket;
    }
  }

  return { tools, agents, workflows, toolProvidersFragment };
}
