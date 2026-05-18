import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import { extractWorkspaceId } from './extract-workspace-id';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

function flattenAgentSkills(skills: StoredAgent['skills'] | undefined): Record<string, unknown> {
  if (!skills) return {};
  if (Array.isArray(skills)) {
    const merged: Record<string, unknown> = {};
    for (const variant of skills) {
      Object.assign(merged, variant.value);
    }
    return merged;
  }
  return skills as Record<string, unknown>;
}

/**
 * Pull the static `{ provider, name }` model out of a stored agent, if present.
 *
 * `StorageConditionalField<T>` is `T | StorageConditionalVariant<T>[]`, so:
 * - object with `provider` + `name` (strings)            → static model, surface in the form.
 * - array (conditional model) or anything unrecognized   → return `undefined`; the form
 *   doesn't own conditional models. The UI renders a read-only banner instead.
 */
export function extractStaticModel(model: StoredAgent['model'] | undefined): AgentBuilderModel | undefined {
  if (!model || Array.isArray(model)) return undefined;
  const provider = (model as { provider?: unknown }).provider;
  const name = (model as { name?: unknown }).name;
  if (typeof provider === 'string' && provider.length > 0 && typeof name === 'string' && name.length > 0) {
    return { provider, name };
  }
  return undefined;
}

/**
 * `true` when the stored agent's model is configured conditionally (in code).
 * The form shows a read-only banner for these — v1 does not support editing
 * conditional models in the playground UI.
 */
export function isConditionalStoredModel(model: StoredAgent['model'] | undefined): boolean {
  return Array.isArray(model);
}

export function storedAgentToFormValues(storedAgent: StoredAgent | null | undefined): AgentBuilderEditFormValues {
  const avatarUrl =
    storedAgent?.metadata && typeof storedAgent.metadata === 'object' && 'avatarUrl' in storedAgent.metadata
      ? (storedAgent.metadata.avatarUrl as string | undefined)
      : undefined;

  return {
    name: storedAgent?.name ?? '',
    description: storedAgent?.description ?? '',
    instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
    tools: Object.fromEntries(Object.keys(storedAgent?.tools ?? {}).map(k => [k, true])),
    agents: Object.fromEntries(Object.keys(storedAgent?.agents ?? {}).map(k => [k, true])),
    workflows: Object.fromEntries(Object.keys(storedAgent?.workflows ?? {}).map(k => [k, true])),
    skills: Object.fromEntries(Object.keys(flattenAgentSkills(storedAgent?.skills)).map(k => [k, true])),
    workspaceId: extractWorkspaceId(storedAgent?.workspace),
    browserEnabled: storedAgent?.browser != null,
    visibility: storedAgent?.visibility,
    avatarUrl,
    model: extractStaticModel(storedAgent?.model),
  };
}
