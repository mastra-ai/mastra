import type { StoredIntegrationConnection, StoredToolIntegrationConfig } from '@mastra/client-js';
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

/**
 * `true` when the stored agent's `toolIntegrations` is a conditional variant
 * array. v1 has no UI for conditional integration configs — the field is
 * surfaced as `undefined` and `useSaveAgent` preserves the original on save.
 */
export function isConditionalStoredToolIntegrations(value: StoredAgent['toolIntegrations'] | undefined): boolean {
  return Array.isArray(value);
}

/**
 * Read `storedAgent.toolIntegrations` into the form shape:
 * - Static record → mirrored object with `toolService` denormalized onto each
 *   `tools[slug]` entry by inferring it from the `connections` map. Tools
 *   whose toolService can't be inferred are dropped.
 * - Conditional variant (array) or anything unrecognized → `undefined`. The
 *   save hook preserves the original stored shape so we never silently
 *   overwrite code-authored config.
 */
export function extractFormToolIntegrations(
  value: StoredAgent['toolIntegrations'] | undefined,
): AgentBuilderEditFormValues['toolIntegrations'] {
  if (!value || Array.isArray(value)) return undefined;
  const staticValue = value as Record<string, StoredToolIntegrationConfig>;
  const result: NonNullable<AgentBuilderEditFormValues['toolIntegrations']> = {};

  for (const [providerId, config] of Object.entries(staticValue)) {
    const connectionsByService: Record<string, StoredIntegrationConnection[]> = config.connections ?? {};
    // Build slug → toolService map by scanning connections (cheap; usually 1-3 services).
    const services = Object.keys(connectionsByService);
    const findServiceForSlug = (slug: string): string | undefined => {
      // Composio convention: tool slugs are `SERVICE_ACTION`. Match by prefix
      // against any known service (case-insensitive). When that fails, fall
      // back to the lone service if there's only one.
      const lowered = slug.toLowerCase();
      const byPrefix = services.find(
        svc => lowered.startsWith(`${svc.toLowerCase()}_`) || lowered === svc.toLowerCase(),
      );
      if (byPrefix) return byPrefix;
      if (services.length === 1) return services[0];
      return undefined;
    };

    const tools: NonNullable<AgentBuilderEditFormValues['toolIntegrations']>[string]['tools'] = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      // Prefer the stored `toolService` (canonical) and fall back to
      // inferring from slug/connection shape for pre-fix stored data.
      const toolService = meta?.toolService ?? findServiceForSlug(slug);
      if (!toolService) continue;
      tools[slug] = { toolService, ...(meta?.description ? { description: meta.description } : {}) };
    }

    result[providerId] = {
      tools,
      connections: connectionsByService as NonNullable<
        AgentBuilderEditFormValues['toolIntegrations']
      >[string]['connections'],
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
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
    toolIntegrations: extractFormToolIntegrations(storedAgent?.toolIntegrations),
  };
}
