import type { IMastraLogger } from '../logger';
import { MASTRA_RESOURCE_ID_KEY } from '../request-context';
import type { ToolAction } from '../tools/types';
import type { ToolProvider, ToolProviderConnection, ToolProviders } from './types';
import { SHARED_BUCKET_ID } from './types';

/**
 * Lookup function the runtime uses to resolve a registered provider by id.
 */
export type ToolProviderLookup = (providerId: string) => ToolProvider;

export interface ResolveStoredToolProvidersOpts {
  /** Per-request context plumbed to each `provider.resolveToolsV2` call. */
  requestContext?: Record<string, unknown>;
  /**
   * Agent author's user id. Used as the provider user bucket for
   * `kind: 'author'` connections so pinned credentials work for any invoker.
   */
  authorId?: string;
  /** Optional logger for non-fatal per-connection warnings. */
  logger?: IMastraLogger;
}

/**
 * Sanitize a connection label into the suffix segment appended to a tool slug
 * (`__<SUFFIX>`).
 *
 * Rules:
 * - Uppercase.
 * - Non-`[A-Z0-9_]` characters become `_`.
 * - On collision with `usedSuffixes`, append `_2`, `_3`, ... until unique.
 * - The returned suffix is added to `usedSuffixes` in place.
 */
export function buildConnectionSuffix(label: string | undefined, usedSuffixes: Set<string>): string {
  const base =
    (label ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'CONN';

  let candidate = base;
  let n = 2;
  while (usedSuffixes.has(candidate)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  usedSuffixes.add(candidate);
  return candidate;
}

/**
 * Provider-agnostic runtime fan-out.
 *
 * For every stored `toolProviders[providerId].connections[toolkit]`
 * entry, calls `provider.resolveToolsV2` once per connection, then renames
 * the resulting tools with a `__<LABEL>` suffix when more than one
 * connection is bound to the same toolkit. Single-connection toolkits keep
 * the natural slug.
 *
 * Each renamed tool also gets a routing hint appended to its description so
 * the LLM can disambiguate between connections.
 *
 * Errors from one connection do **not** poison sibling connections — they are
 * logged and skipped.
 */
export async function resolveStoredToolProviders(
  toolProviders: ToolProviders | undefined,
  lookup: ToolProviderLookup,
  opts: ResolveStoredToolProvidersOpts = {},
): Promise<Record<string, ToolAction<any, any, any>>> {
  const { requestContext, authorId, logger } = opts;
  const out: Record<string, ToolAction<any, any, any>> = {};
  if (!toolProviders || Object.keys(toolProviders).length === 0) return out;

  for (const [providerId, cfg] of Object.entries(toolProviders)) {
    let provider: ToolProvider;
    try {
      provider = lookup(providerId);
    } catch (error) {
      logger?.warn(`[resolveStoredToolProviders] Unknown provider "${providerId}"`, { error });
      continue;
    }

    if (!provider.resolveToolsV2) {
      logger?.warn(`[resolveStoredToolProviders] Provider "${providerId}" does not implement resolveToolsV2`);
      continue;
    }

    const tools = cfg.tools ?? {};
    const connectionsByToolkit = cfg.connections ?? {};

    for (const [toolkit, connections] of Object.entries(connectionsByToolkit)) {
      if (!connections || connections.length === 0) continue;

      if (connections.length > 1 && !provider.capabilities?.multipleConnectionsPerToolkit) {
        throw new Error(
          `Provider "${providerId}" does not support multiple connections per toolkit ` +
            `but received ${connections.length} for "${toolkit}".`,
        );
      }

      // Group selected slugs by ToolProviderToolMeta.toolkit. Falls back to a
      // slug-prefix match (`<toolkit>.<tool>`) for providers that follow the
      // dot convention but didn't write toolkit on the meta entry.
      const slugsForToolkit = Object.entries(tools)
        .filter(([slug, meta]) => (meta?.toolkit ? meta.toolkit === toolkit : slug.startsWith(`${toolkit}.`)))
        .map(([slug]) => slug);
      if (slugsForToolkit.length === 0) continue;

      const skipSuffix = connections.length === 1;
      const usedSuffixes = new Set<string>();

      for (const connection of connections) {
        const suffix = skipSuffix ? '' : `__${buildConnectionSuffix(connection.label, usedSuffixes)}`;

        const resolvedAuthorId = resolveConnectionAuthorId(connection, authorId, requestContext);

        let resolved: Record<string, ToolAction<any, any, any>>;
        try {
          resolved = await provider.resolveToolsV2({
            toolSlugs: slugsForToolkit,
            toolMeta: cfg.tools ?? {},
            connectionId: connection.connectionId,
            authorId: resolvedAuthorId,
            requestContext,
          });
        } catch (error) {
          logger?.warn(
            `[resolveStoredToolProviders] Failed to resolve tools for ${providerId}/${toolkit} ` +
              `connection ${connection.connectionId}`,
            { error },
          );
          continue;
        }

        for (const [slug, tool] of Object.entries(resolved)) {
          const renamedSlug = `${slug}${suffix}`;
          const baseDescription = tool.description ?? '';
          const description = skipSuffix ? baseDescription : appendRoutingHint(baseDescription, connection);

          out[renamedSlug] = {
            ...tool,
            id: renamedSlug,
            description,
          } as ToolAction<any, any, any>;
        }
      }
    }
  }

  return out;
}

/**
 * Resolve the provider user bucket for a pinned connection.
 *
 * - `kind !== 'author'` → undefined (invoker/platform are reserved for later phases).
 * - `scope === 'shared'` → {@link SHARED_BUCKET_ID}.
 * - `scope === 'caller-supplied'` → `requestContext[MASTRA_RESOURCE_ID_KEY]` when
 *   present, otherwise falls back to the shared `'default'` bucket (matching legacy
 *   `ComposioToolProvider` semantics on main). Multi-tenant deployments should wire
 *   `authConfig.mapUserToResourceId` to avoid cross-user bucket sharing.
 * - otherwise → the caller's resolved authorId.
 */
function resolveConnectionAuthorId(
  connection: ToolProviderConnection,
  callerAuthorId: string | undefined,
  requestContext: Record<string, unknown> | undefined,
): string | undefined {
  if (connection.kind !== 'author') return undefined;
  if (connection.scope === 'shared') return SHARED_BUCKET_ID;
  if (connection.scope === 'caller-supplied') {
    const resourceId = requestContext?.[MASTRA_RESOURCE_ID_KEY];
    if (typeof resourceId === 'string' && resourceId.length > 0) return resourceId;
    // Match legacy ComposioToolProvider behavior: when the host app has not
    // wired requestContext[MASTRA_RESOURCE_ID_KEY] (e.g. via
    // authConfig.mapUserToResourceId), fall back to a shared 'default' bucket
    // so tools still resolve. Multi-tenant deployments must wire the resource
    // id explicitly to avoid cross-user bucket sharing.
    return 'default';
  }
  return callerAuthorId;
}

function appendRoutingHint(description: string, connection: ToolProviderConnection): string {
  const hint = `Routes through connection: ${connection.label ?? connection.connectionId}`;
  if (!description) return hint;
  return `${description}\n\n${hint}`;
}
