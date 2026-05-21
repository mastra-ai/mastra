import type {
  StoredToolProviderConnection,
  StoredToolProviderToolMeta,
  StoredToolProviderConfig,
} from '@mastra/client-js';

import type { ToolProvidersFormValue } from '../schemas';

/**
 * Shared mappers for `toolProviders` between the form shape and the stored
 * agent shape. Used by both the Agent Builder and the CMS agent editor so
 * round-trip behaviour stays identical across surfaces.
 */

export function buildToolProvidersForSave(
  value: ToolProvidersFormValue | undefined,
): Record<string, StoredToolProviderConfig> | undefined {
  if (!value) return undefined;
  const result: Record<string, StoredToolProviderConfig> = {};

  for (const [providerId, config] of Object.entries(value)) {
    const tools: Record<string, StoredToolProviderToolMeta> = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      // Persist `toolkit` on every tool entry. The runtime fan-out
      // groups selected slugs by this field — it cannot assume a
      // `<service>.<tool>` slug convention because providers like
      // Composio return flat slugs (e.g. GMAIL_FETCH_EMAILS).
      tools[slug] = meta;
    }

    const connections: Record<string, StoredToolProviderConnection[]> = {};
    for (const [toolkit, list] of Object.entries(config.connections ?? {})) {
      connections[toolkit] = list.map(connection => {
        const trimmed = connection.label?.trim();
        // Drop empty/whitespace-only labels so storage only carries meaningful values.
        // The form / server enforce label *requirement* via superRefine; here we just
        // normalize the payload.
        const { label: _label, ...rest } = connection;
        return {
          ...rest,
          kind: 'author' as const,
          ...(trimmed ? { label: trimmed } : {}),
          // Preserve scope verbatim. Absent → runtime treats as `per-author`.
          ...(connection.scope ? { scope: connection.scope } : {}),
        };
      });
    }

    result[providerId] = { tools, connections };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * `true` when the stored agent's `toolProviders` is a conditional variant
 * array. v1 has no UI for conditional provider configs — the field is
 * surfaced as `undefined` and `useSaveAgent` preserves the original on save.
 */
export function isConditionalStoredToolProviders(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Read `storedAgent.toolProviders` into the form shape:
 * - Static record → mirrored object with `toolkit` denormalized onto each
 *   `tools[slug]` entry by inferring it from the `connections` map. Tools
 *   whose toolkit can't be inferred are dropped.
 * - Conditional variant (array) or anything unrecognized → `undefined`. The
 *   save hook preserves the original stored shape so we never silently
 *   overwrite code-authored config.
 */
export function extractFormToolProviders(value: unknown): ToolProvidersFormValue | undefined {
  if (!value || Array.isArray(value)) return undefined;
  const staticValue = value as Record<string, StoredToolProviderConfig>;
  const result: NonNullable<ToolProvidersFormValue> = {};

  for (const [providerId, config] of Object.entries(staticValue)) {
    const connectionsByService: Record<string, StoredToolProviderConnection[]> = config.connections ?? {};
    // Build slug → toolkit map by scanning connections (cheap; usually 1-3 services).
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

    const tools: NonNullable<ToolProvidersFormValue>[string]['tools'] = {};
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      // Prefer the stored `toolkit` (canonical) and fall back to
      // inferring from slug/connection shape for pre-fix stored data.
      const toolkit = meta?.toolkit ?? findServiceForSlug(slug);
      if (!toolkit) continue;
      tools[slug] = { toolkit, ...(meta?.description ? { description: meta.description } : {}) };
    }

    result[providerId] = {
      tools,
      connections: connectionsByService as NonNullable<ToolProvidersFormValue>[string]['connections'],
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
