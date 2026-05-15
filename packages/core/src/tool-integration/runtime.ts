import type { IMastraLogger } from '../logger';
import type { ToolAction } from '../tools/types';
import type { Connection, ToolIntegration, ToolIntegrations } from './tool-integration';

/**
 * Lookup function the runtime uses to resolve a registered integration by id.
 * The editor passes `(id) => editor.getToolIntegrationOrThrow(id)`; tests can
 * pass a Map-backed function. Keeping it a function lets the runtime live in
 * core without importing `@mastra/editor`.
 */
export type ToolIntegrationLookup = (integrationId: string) => ToolIntegration;

export interface ResolveStoredToolIntegrationsOpts {
  /** Per-request context plumbed to each `integration.resolveTools` call. */
  requestContext?: Record<string, unknown>;
  /**
   * Agent author's user id. Used as the integration user bucket for
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
 * Provider-agnostic runtime fan-out — per ARCHITECTURE §8.
 *
 * For every stored `toolIntegrations[providerId].connections[toolService]`
 * entry, calls `integration.resolveTools` once per connection, then renames
 * the resulting tools with a `__<LABEL>` suffix when more than one connection
 * is bound to the same tool service. Single-connection tool services keep the
 * natural slug.
 *
 * Each renamed tool also gets a routing hint appended to its description so
 * the LLM can disambiguate between connections.
 *
 * Errors from one connection do **not** poison sibling connections — they are
 * logged and skipped.
 */
export async function resolveStoredToolIntegrations(
  toolIntegrations: ToolIntegrations | undefined,
  lookup: ToolIntegrationLookup,
  opts: ResolveStoredToolIntegrationsOpts = {},
): Promise<Record<string, ToolAction<any, any, any>>> {
  const { requestContext, authorId, logger } = opts;
  const out: Record<string, ToolAction<any, any, any>> = {};
  if (!toolIntegrations || Object.keys(toolIntegrations).length === 0) return out;

  for (const [providerId, cfg] of Object.entries(toolIntegrations)) {
    let integration: ToolIntegration;
    try {
      integration = lookup(providerId);
    } catch (error) {
      logger?.warn(`[resolveStoredToolIntegrations] Unknown integration "${providerId}"`, { error });
      continue;
    }

    const tools = cfg.tools ?? {};
    const connectionsByService = cfg.connections ?? {};

    for (const [toolService, connections] of Object.entries(connectionsByService)) {
      if (!connections || connections.length === 0) continue;

      if (connections.length > 1 && !integration.capabilities.multipleConnectionsPerService) {
        throw new Error(
          `Integration "${providerId}" does not support multiple connections per tool service ` +
            `but received ${connections.length} for "${toolService}".`,
        );
      }

      // Group selected slugs by ToolMeta.toolService. Falls back to a
      // slug-prefix match (`<service>.<tool>`) for providers that follow the
      // dot convention but didn't write toolService on the meta entry.
      const slugsForService = Object.entries(tools)
        .filter(([slug, meta]) =>
          meta?.toolService ? meta.toolService === toolService : slug.startsWith(`${toolService}.`),
        )
        .map(([slug]) => slug);
      if (slugsForService.length === 0) continue;

      const skipSuffix = connections.length === 1;
      const usedSuffixes = new Set<string>();

      for (const connection of connections) {
        const suffix = skipSuffix ? '' : `__${buildConnectionSuffix(connection.label, usedSuffixes)}`;

        let resolved: Record<string, ToolAction<any, any, any>>;
        try {
          resolved = await integration.resolveTools({
            toolSlugs: slugsForService,
            toolMeta: cfg.tools ?? {},
            connectionId: connection.connectionId,
            authorId: connection.kind === 'author' ? authorId : undefined,
            requestContext,
          });
        } catch (error) {
          logger?.warn(
            `[resolveStoredToolIntegrations] Failed to resolve tools for ${providerId}/${toolService} ` +
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

function appendRoutingHint(description: string, connection: Connection): string {
  const hint = `Routes through connection: ${connection.label ?? connection.connectionId}`;
  if (!description) return hint;
  return `${description}\n\n${hint}`;
}
