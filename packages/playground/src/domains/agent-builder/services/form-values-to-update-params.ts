import type { StoredAgentResponse, StoredAgentToolConfig, StoredSkillResponse } from '@mastra/client-js';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import { formValuesToSaveParams } from './form-values-to-save-params';
import { storedAgentToFormValues } from './stored-agent-to-form-values';

function preserveSelectedConfigs<T>(
  selected: Record<string, T>,
  stored: Record<string, T> | { value: Record<string, T>; rules?: StoredAgentToolConfig['rules'] }[] | undefined,
) {
  if (Array.isArray(stored)) {
    const storedIds = new Set(stored.flatMap(variant => Object.keys(variant.value)));
    const added = Object.fromEntries(Object.entries(selected).filter(([id]) => !storedIds.has(id)));
    const variants = stored.map(variant => ({
      ...variant,
      value: Object.fromEntries(Object.entries(variant.value).filter(([id]) => id in selected)),
    }));
    if (Object.keys(added).length > 0) variants.push({ value: added });
    return variants;
  }
  return Object.fromEntries(Object.entries(selected).map(([id, config]) => [id, stored?.[id] ?? config]));
}

function hasChanged(current: unknown, previous: unknown) {
  return JSON.stringify(current) !== JSON.stringify(previous);
}

export function formValuesToUpdateParams(
  values: AgentBuilderEditFormValues,
  storedAgent: StoredAgentResponse,
  availableAgentTools: AgentTool[],
  availableSkills: StoredSkillResponse[] = [],
) {
  const params = formValuesToSaveParams(values, availableAgentTools, availableSkills);
  const previous = formValuesToSaveParams(storedAgentToFormValues(storedAgent), availableAgentTools, availableSkills);

  return {
    ...(params.name !== previous.name ? { name: params.name } : {}),
    ...(params.description !== previous.description ? { description: params.description ?? '' } : {}),
    ...(params.instructions !== previous.instructions ? { instructions: params.instructions } : {}),
    ...(hasChanged(params.tools, previous.tools)
      ? { tools: preserveSelectedConfigs(params.tools, storedAgent.tools) }
      : {}),
    ...(hasChanged(params.agents, previous.agents)
      ? { agents: preserveSelectedConfigs(params.agents, storedAgent.agents) }
      : {}),
    ...(hasChanged(params.workflows, previous.workflows)
      ? { workflows: preserveSelectedConfigs(params.workflows, storedAgent.workflows) }
      : {}),
    ...(hasChanged(params.skills, previous.skills)
      ? { skills: preserveSelectedConfigs(params.skills, storedAgent.skills) }
      : {}),
    ...(hasChanged(params.model, previous.model) ? { model: params.model } : {}),
    ...(hasChanged(params.workspace, previous.workspace) ? { workspace: params.workspace } : {}),
    ...(params.browser !== previous.browser ? { browser: params.browser } : {}),
    ...(params.visibility !== previous.visibility ? { visibility: params.visibility } : {}),
    ...(hasChanged(params.metadata, previous.metadata) ? { metadata: params.metadata } : {}),
    ...(hasChanged(params.toolProviders, previous.toolProviders) ? { toolProviders: params.toolProviders } : {}),
  };
}
