import type { StoredAgent } from '@mastra/react/hooks/agents';
import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import { extractWorkspaceId } from './extract-workspace-id';
import { extractFormToolProviders } from '@/domains/tool-providers/mappers/tool-providers-form-mappers';

function selectedIds(config: StoredAgent['tools'] | StoredAgent['skills']): Record<string, boolean> {
  const records = Array.isArray(config) ? config.map(variant => variant.value) : [config ?? {}];
  return Object.fromEntries(records.flatMap(record => Object.keys(record).map(id => [id, true])));
}

export function extractStaticModel(model: StoredAgent['model'] | undefined): AgentBuilderModel | undefined {
  if (!model || Array.isArray(model)) return undefined;
  const { provider, name } = model;
  if (typeof provider === 'string' && provider.length > 0 && typeof name === 'string' && name.length > 0) {
    return { provider, name };
  }
  return undefined;
}

export function isConditionalStoredModel(model: StoredAgent['model'] | undefined): boolean {
  return Array.isArray(model);
}

export function storedAgentToFormValues(storedAgent: StoredAgent | null | undefined): AgentBuilderEditFormValues {
  const storedAvatarUrl = storedAgent?.metadata?.avatarUrl;
  const avatarUrl = typeof storedAvatarUrl === 'string' ? storedAvatarUrl : undefined;

  return {
    name: storedAgent?.name ?? '',
    description: storedAgent?.description ?? '',
    instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
    tools: selectedIds(storedAgent?.tools),
    agents: selectedIds(storedAgent?.agents),
    workflows: selectedIds(storedAgent?.workflows),
    skills: selectedIds(storedAgent?.skills),
    workspaceId: extractWorkspaceId(storedAgent?.workspace),
    browserEnabled: storedAgent?.browser != null,
    visibility: storedAgent?.visibility,
    avatarUrl,
    model: extractStaticModel(storedAgent?.model),
    toolProviders: extractFormToolProviders(storedAgent?.toolProviders),
  };
}
