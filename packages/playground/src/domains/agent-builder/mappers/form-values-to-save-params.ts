import type {
  StoredAgentSkillConfig,
  StoredAgentToolConfig,
  StoredIntegrationConnection,
  StoredIntegrationToolMeta,
  StoredSkillResponse,
  StoredToolIntegrationConfig,
  StoredWorkspaceRef,
} from '@mastra/client-js';
import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import type { AgentTool } from '../types/agent-tool';

export interface SaveParams {
  name: string;
  description: string | undefined;
  instructions: string;
  tools: Record<string, StoredAgentToolConfig>;
  agents: Record<string, StoredAgentToolConfig>;
  workflows: Record<string, StoredAgentToolConfig>;
  skills: Record<string, StoredAgentSkillConfig>;
  workspace: StoredWorkspaceRef | undefined;
  /** `true` = enable browser (server applies default config); `false` = disable browser */
  browser: boolean;
  visibility: 'private' | 'public' | undefined;
  /**
   * Static model selection from the form. Conditional models are owned by code;
   * the form never round-trips them, so this is always either `undefined` or
   * a `{ provider, name }` pair.
   */
  model: AgentBuilderModel | undefined;
  metadata: Record<string, unknown> | undefined;
  /**
   * Selected tool-integration tools and connections. Emitted only when the
   * form value is non-empty. `kind` is hardcoded to `'author'` for v1.
   * Conditional stored variants are not represented in the form and are
   * preserved separately by `useSaveAgent`.
   */
  toolIntegrations: Record<string, StoredToolIntegrationConfig> | undefined;
}

function buildToolIntegrations(
  value: AgentBuilderEditFormValues['toolIntegrations'],
): Record<string, StoredToolIntegrationConfig> | undefined {
  if (!value) return undefined;
  const result: Record<string, StoredToolIntegrationConfig> = {};

  for (const [providerId, config] of Object.entries(value)) {
    const tools: Record<string, StoredIntegrationToolMeta> = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      // Strip form-only `toolService` — storage keeps it on connections only.
      const { toolService: _omit, ...rest } = meta;
      void _omit;
      tools[slug] = rest;
    }

    const connections: Record<string, StoredIntegrationConnection[]> = {};
    for (const [toolService, list] of Object.entries(config.connections ?? {})) {
      connections[toolService] = list.map(connection => ({
        ...connection,
        kind: 'author' as const,
      }));
    }

    result[providerId] = { tools, connections };
  }

  return Object.keys(result).length > 0 ? result : undefined;
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

  const workspace: StoredWorkspaceRef | undefined =
    typeof values.workspaceId === 'string' && values.workspaceId.length > 0
      ? { type: 'id', workspaceId: values.workspaceId }
      : undefined;

  const description = values.description?.trim() ? values.description.trim() : undefined;

  const metadata: Record<string, unknown> | undefined = values.avatarUrl ? { avatarUrl: values.avatarUrl } : undefined;

  const browser = values.browserEnabled === true;

  return {
    name: values.name,
    description,
    instructions: values.instructions,
    tools,
    agents,
    workflows,
    skills: skills as Record<string, StoredAgentSkillConfig>,
    workspace,
    browser,
    visibility: values.visibility,
    model: values.model,
    metadata,
    toolIntegrations: buildToolIntegrations(values.toolIntegrations),
  };
}
