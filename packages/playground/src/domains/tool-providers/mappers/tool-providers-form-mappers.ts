import type {
  StoredToolProviderConnection,
  StoredToolProviderToolMeta,
  StoredToolProviderConfig,
} from '@mastra/client-js';

import type { ToolProvidersFormValue } from '../schemas';

/**
 * Shared mappers for `toolProviders` between the form shape and the stored
 * agent shape.
 */

export function buildToolProvidersForSave(
  value: ToolProvidersFormValue | undefined,
): Record<string, StoredToolProviderConfig> | undefined {
  if (!value) return undefined;
  const result: Record<string, StoredToolProviderConfig> = {};

  for (const [providerId, config] of Object.entries(value)) {
    const tools: Record<string, StoredToolProviderToolMeta> = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      tools[slug] = meta;
    }

    const connections: Record<string, StoredToolProviderConnection[]> = {};
    for (const [toolkit, list] of Object.entries(config.connections ?? {})) {
      connections[toolkit] = list.map(connection => ({
        kind: 'author' as const,
        toolkit: connection.toolkit,
        connectionId: connection.connectionId,
        ...(connection.label?.trim() ? { label: connection.label.trim() } : {}),
        ...(connection.scope ? { scope: connection.scope } : {}),
      }));
    }

    result[providerId] = { tools, connections };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * `true` when the stored agent's `toolProviders` is a conditional variant
 * array. v1 has no UI for conditional provider configs — the field is
 * surfaced as `undefined` and the save hook preserves the original on save.
 */
export function isConditionalStoredToolProviders(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Read `storedAgent.toolProviders` into the form shape.
 */
export function extractFormToolProviders(value: unknown): ToolProvidersFormValue | undefined {
  if (!value || Array.isArray(value)) return undefined;
  const staticValue = value as Record<string, StoredToolProviderConfig>;
  const result: NonNullable<ToolProvidersFormValue> = {};

  for (const [providerId, config] of Object.entries(staticValue)) {
    // Persisted configs can be malformed (e.g. `{ composio: null }`); skip
    // anything that isn't a plain object so hydration never throws.
    if (typeof config !== 'object' || config === null) continue;
    const connectionsByService: Record<string, StoredToolProviderConnection[]> = config.connections ?? {};
    const services = Object.keys(connectionsByService);
    const findServiceForSlug = (slug: string): string | undefined => {
      const lowered = slug.toLowerCase();
      const byPrefix = services.find(
        svc => lowered.startsWith(`${svc.toLowerCase()}_`) || lowered === svc.toLowerCase(),
      );
      if (byPrefix) return byPrefix;
      if (services.length === 1) return services[0];
      return undefined;
    };

    const tools: NonNullable<ToolProvidersFormValue>[string]['tools'] = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      const toolkit = meta?.toolkit ?? findServiceForSlug(slug);
      if (!toolkit) continue;
      tools[slug] = { toolkit, ...(meta?.description ? { description: meta.description } : {}) };
    }

    const connections: NonNullable<ToolProvidersFormValue>[string]['connections'] = {};
    for (const [toolkit, list] of Object.entries(connectionsByService)) {
      connections[toolkit] = list.map(c => ({
        kind: 'author' as const,
        toolkit,
        connectionId: c.connectionId,
        ...(c.label?.trim() ? { label: c.label.trim() } : {}),
        ...(c.scope ? { scope: c.scope } : {}),
      }));
    }

    result[providerId] = { tools, connections };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
