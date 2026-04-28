import type {
  StoredAgentSkillConfig,
  StoredAgentToolConfig,
  StoredSkillResponse,
  StoredWorkspaceRef,
} from '@mastra/client-js';
import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import type { AgentTool } from '../types/agent-tool';

export interface SaveParams {
  name: string;
  description: string | undefined;
  instructions: string;
  tools: Record<string, StoredAgentToolConfig> | undefined;
  agents: Record<string, StoredAgentToolConfig> | undefined;
  workflows: Record<string, StoredAgentToolConfig> | undefined;
  skills: Record<string, StoredAgentSkillConfig> | undefined;
  workspace: StoredWorkspaceRef | undefined;
  visibility: 'private' | 'public';
  /**
   * Static model selection from the form. Conditional models are owned by code;
   * the form never round-trips them, so this is always either `undefined` or
   * a `{ provider, name }` pair.
   */
  model: AgentBuilderModel | undefined;
  metadata: Record<string, unknown> | undefined;
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

export function formValuesToSaveParams(
  values: AgentBuilderEditFormValues,
  availableAgentTools: AgentTool[],
  availableSkills: StoredSkillResponse[] = [],
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

  const skillDescriptionById = new Map<string, string | undefined>();
  for (const skill of availableSkills) {
    skillDescriptionById.set(skill.id, skill.description);
  }

  const tools = buildEnabledRecord(values.tools, toolDescriptionById);
  const agents = buildEnabledRecord(values.agents, agentDescriptionById);
  const workflows = buildEnabledRecord(values.workflows, workflowDescriptionById);
  const skills = buildEnabledRecord(values.skills, skillDescriptionById);

  const orUndefined = (rec: Record<string, unknown>) => (Object.keys(rec).length === 0 ? undefined : rec);

  const workspace: StoredWorkspaceRef | undefined =
    typeof values.workspaceId === 'string' && values.workspaceId.length > 0
      ? { type: 'id', workspaceId: values.workspaceId }
      : undefined;

  const description = values.description?.trim() ? values.description.trim() : undefined;

  const metadata: Record<string, unknown> | undefined = values.avatarUrl ? { avatarUrl: values.avatarUrl } : undefined;

  return {
    name: values.name,
    description,
    instructions: values.instructions,
    tools: orUndefined(tools) as SaveParams['tools'],
    agents: orUndefined(agents) as SaveParams['agents'],
    workflows: orUndefined(workflows) as SaveParams['workflows'],
    skills: orUndefined(skills) as SaveParams['skills'],
    workspace,
    visibility: values.visibility ?? 'private',
    model: values.model,
    metadata,
  };
}
