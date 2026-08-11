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
  /** Per-request context plumbed to each `provider.resolveToolsVNext` call. */
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
  // Single linear pass over the input — no regex with quantifiers on
  // user-controlled data (CodeQL js/polynomial-redos).
  const raw = (label ?? '').toUpperCase();
  let base = '';
  let prevWasUnderscore = true; // start true → skips leading underscores
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    const isAllowed =
      (c >= 0x41 && c <= 0x5a) || // A-Z
      (c >= 0x30 && c <= 0x39); // 0-9
    if (isAllowed) {
      base += raw[i];
      prevWasUnderscore = false;
    } else if (!prevWasUnderscore) {
      base += '_';
      prevWasUnderscore = true;
    }
  }
  if (base.endsWith('_')) base = base.slice(0, -1);
  if (!base) base = 'CONN';

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
 * entry, calls `provider.resolveToolsVNext` once per connection. A provider
 * whose default scope is `caller-supplied` is also called once for each
 * selected toolkit without a pinned connection, using the request resource id
 * as its dynamic connection bucket. This lets connection-management and other
 * connectionless tools bootstrap a caller's first OAuth connection.
 *
 * Tools resolved through multiple pinned connections are renamed with a
 * `__<LABEL>` suffix. Single-connection and unpinned caller-supplied toolkits
 * keep the natural slug.
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
  logger?.debug(`[resolveStoredToolProviders] called`, {
    providerIds: Object.keys(toolProviders ?? {}),
    authorId,
  });
  if (!toolProviders || Object.keys(toolProviders).length === 0) {
    logger?.debug(`[resolveStoredToolProviders] no toolProviders on agent — returning {}`);
    return out;
  }

  for (const [providerId, cfg] of Object.entries(toolProviders)) {
    let provider: ToolProvider;
    try {
      provider = lookup(providerId);
    } catch (error) {
      logger?.warn(`[resolveStoredToolProviders] Unknown provider "${providerId}"`, { error });
      continue;
    }

    if (!provider.resolveToolsVNext) {
      logger?.warn(`[resolveStoredToolProviders] Provider "${providerId}" does not implement resolveToolsVNext`);
      continue;
    }

    const tools = cfg.tools ?? {};
    const connectionsByToolkit = cfg.connections ?? {};

    // `caller-supplied` providers resolve within the current request's user
    // bucket, so they do not need a persisted account pin to materialise a
    // selected toolkit. This is required for bootstrap tools such as
    // COMPOSIO_MANAGE_CONNECTIONS, whose own toolkit intentionally has no
    // OAuth connection.
    if (provider.defaultScope === 'caller-supplied') {
      const unpinnedSlugsByToolkit = new Map<string, string[]>();
      for (const [slug, meta] of Object.entries(tools)) {
        const separatorIndex = slug.indexOf('.');
        const toolkit = meta?.toolkit ?? (separatorIndex > 0 ? slug.slice(0, separatorIndex) : undefined);
        if (!toolkit || connectionsByToolkit[toolkit]?.length) continue;
        const slugs = unpinnedSlugsByToolkit.get(toolkit) ?? [];
        slugs.push(slug);
        unpinnedSlugsByToolkit.set(toolkit, slugs);
      }

      if (unpinnedSlugsByToolkit.size > 0) {
        const resolvedAuthorId = resolveCallerSuppliedAuthorId(requestContext, logger);
        for (const [toolkit, toolSlugs] of unpinnedSlugsByToolkit) {
          logger?.debug(
            `[resolveStoredToolProviders] resolving unpinned caller-supplied tools for ${providerId}/${toolkit}`,
            { slugs: toolSlugs },
          );

          try {
            const resolved = await provider.resolveToolsVNext({
              toolSlugs,
              toolMeta: tools,
              connectionId: resolvedAuthorId,
              authorId: resolvedAuthorId,
              scope: 'caller-supplied',
              requestContext,
            });

            for (const [slug, tool] of Object.entries(resolved)) {
              out[slug] = { ...tool, id: slug } as ToolAction<any, any, any>;
            }
          } catch (error) {
            logger?.warn(
              `[resolveStoredToolProviders] Failed to resolve unpinned caller-supplied tools for ${providerId}/${toolkit}`,
              { error },
            );
          }
        }
      }
    }

    for (const [toolkit, connections] of Object.entries(connectionsByToolkit)) {
      if (!connections || connections.length === 0) {
        logger?.debug(
          `[resolveStoredToolProviders] toolkit "${toolkit}" on provider "${providerId}" has no pinned connections — skipping`,
        );
        continue;
      }

      if (connections.length > 1 && !provider.capabilities?.multipleConnectionsPerToolkit) {
        logger?.warn(
          `[resolveStoredToolProviders] provider "${providerId}" does not support multiple ` +
            `connections per toolkit but received ${connections.length} for "${toolkit}" — skipping`,
        );
        continue;
      }

      // Group selected slugs by ToolProviderToolMeta.toolkit. Falls back to a
      // slug-prefix match (`<toolkit>.<tool>`) for providers that follow the
      // dot convention but didn't write toolkit on the meta entry.
      const slugsForToolkit = Object.entries(tools)
        .filter(([slug, meta]) => (meta?.toolkit ? meta.toolkit === toolkit : slug.startsWith(`${toolkit}.`)))
        .map(([slug]) => slug);
      if (slugsForToolkit.length === 0) {
        logger?.debug(
          `[resolveStoredToolProviders] toolkit "${toolkit}" on provider "${providerId}" has connections but no matching tool slugs — skipping`,
          { availableSlugs: Object.keys(tools) },
        );
        continue;
      }
      logger?.debug(`[resolveStoredToolProviders] resolving tools for ${providerId}/${toolkit}`, {
        slugs: slugsForToolkit,
        connectionCount: connections.length,
      });

      const skipSuffix = connections.length === 1;
      const usedSuffixes = new Set<string>();

      for (const connection of connections) {
        const suffix = skipSuffix ? '' : `__${buildConnectionSuffix(connection.label, usedSuffixes)}`;

        const resolvedAuthorId = resolveConnectionAuthorId(connection, authorId, requestContext, logger);

        let resolved: Record<string, ToolAction<any, any, any>>;
        try {
          resolved = await provider.resolveToolsVNext({
            toolSlugs: slugsForToolkit,
            toolMeta: cfg.tools ?? {},
            connectionId: connection.connectionId,
            authorId: resolvedAuthorId,
            scope: connection.scope,
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

// Emit a single warn per process when the connection-owner fallback fires.
// Multi-tenant deployments that forget to wire `mapUserToResourceId` silently
// funnel every `caller-supplied` pin into one shared OAuth account — surface
// that misconfiguration once.
let defaultBucketWarned = false;
function warnDefaultBucketFallback(logger: IMastraLogger | undefined): void {
  if (defaultBucketWarned) return;
  defaultBucketWarned = true;
  logger?.warn(
    '[resolveStoredToolProviders] caller-supplied scope falling back to shared "default" bucket — ' +
      'wire authConfig.mapUserToResourceId to avoid cross-tenant OAuth sharing',
  );
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
  logger: IMastraLogger | undefined,
): string | undefined {
  if (connection.kind !== 'author') return undefined;
  if (connection.scope === 'shared') return SHARED_BUCKET_ID;
  if (connection.scope === 'caller-supplied') {
    return resolveCallerSuppliedAuthorId(requestContext, logger);
  }
  return callerAuthorId;
}

function resolveCallerSuppliedAuthorId(
  requestContext: Record<string, unknown> | undefined,
  logger: IMastraLogger | undefined,
): string {
  const resourceId = requestContext?.[MASTRA_RESOURCE_ID_KEY];
  if (typeof resourceId === 'string' && resourceId.length > 0) return resourceId;
  // Match legacy ComposioToolProvider behavior: when the host app has not
  // wired requestContext[MASTRA_RESOURCE_ID_KEY] (e.g. via
  // authConfig.mapUserToResourceId), fall back to a shared 'default' bucket
  // so tools still resolve. Multi-tenant deployments must wire the resource
  // id explicitly to avoid cross-user bucket sharing.
  warnDefaultBucketFallback(logger);
  return 'default';
}

function appendRoutingHint(description: string, connection: ToolProviderConnection): string {
  const hint = `Routes through connection: ${connection.label ?? connection.connectionId}`;
  if (!description) return hint;
  return `${description}\n\n${hint}`;
}
