import type { StoredAgentToolConfig, StoredWorkspaceRef } from '@mastra/client-js';
import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import type { AgentTool } from '../types/agent-tool';

export interface SaveParams {
  name: string;
  description: string | undefined;
  instructions: string;
  tools: Record<string, StoredAgentToolConfig> | undefined;
  agents: Record<string, StoredAgentToolConfig> | undefined;
  workflows: Record<string, StoredAgentToolConfig> | undefined;
  workspace: StoredWorkspaceRef | undefined;
  /**
   * Static model selection from the form. Conditional models are owned by code;
   * the form never round-trips them, so this is always either `undefined` or
   * a `{ provider, name }` pair.
   */
  model: AgentBuilderModel | undefined;
}

function buildEnabledRecord(
  selectedById: Record<string, boolean> | undefined,
  descriptionById: Map<string, string | undefined>,
): Record<string, StoredAgentToolConfig> {
  return Object.fromEntries(
    Object.entries(selectedById ?? {})
      .filter(([, enabled]) => enabled)
      .map(([id]) => {
        const description = descriptionById.get(id);
        return [id, description ? { description } : {}];
      }),
  );
}

function emptyToUndefined<T extends Record<string, unknown>>(record: T): T | undefined {
  return Object.keys(record).length > 0 ? record : undefined;
}

export function formValuesToSaveParams(
  values: AgentBuilderEditFormValues,
  availableAgentTools: AgentTool[],
): SaveParams {
  const toolDescriptionById = new Map<string, string | undefined>();
  const agentDescriptionById = new Map<string, string | undefined>();
  const workflowDescriptionById = new Map<string, string | undefined>();
  for (const item of availableAgentTools) {
    if (item.type === 'tool') {
      toolDescriptionById.set(item.id, item.description);
    } else if (item.type === 'agent') {
      agentDescriptionById.set(item.id, item.description);
    } else {
      workflowDescriptionById.set(item.id, item.description);
    }
  }

  const tools = buildEnabledRecord(values.tools, toolDescriptionById);
  const agents = buildEnabledRecord(values.agents, agentDescriptionById);
  const workflows = buildEnabledRecord(values.workflows, workflowDescriptionById);

  const workspace: StoredWorkspaceRef | undefined =
    typeof values.workspaceId === 'string' && values.workspaceId.length > 0
      ? { type: 'id', workspaceId: values.workspaceId }
      : undefined;

  const description = values.description?.trim() ? values.description.trim() : undefined;

  return {
    name: values.name,
    description,
    instructions: values.instructions,
    tools: emptyToUndefined(tools),
    agents: emptyToUndefined(agents),
    workflows: emptyToUndefined(workflows),
    workspace,
    model: values.model,
  };
}
