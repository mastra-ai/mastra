import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IntegrationCatalogEntry, ProjectConnection } from './client.js';

/**
 * Record key of the built-in connect-prompt tool. Reserved: a provider tool
 * resolving to the same key is a hard error, same as any duplicate.
 */
export const CONNECT_PROMPT_TOOL_KEY = 'request_connection';

/** One connectable provider in a connect-prompt payload. */
export interface ConnectPromptProvider {
  id: string;
  displayName: string | null;
  logoUrl: string | null;
  authType: string | null;
  /** Whether a usable (active) connection already serves this provider for the caller. */
  connected: boolean;
  /** Which connection serves it when connected: the caller's own wins over a global one. */
  scope: 'global' | 'user' | null;
}

/**
 * Structured output of the connect-prompt tool. Chat UIs detect
 * `type: 'connect-prompt'` and render the providers as a connect card; the
 * card drives the mounted `userConnectRoutes()` flow (session → launch gate →
 * status polling), so the tool itself never creates sessions or handles URLs.
 */
export interface ConnectPromptPayload {
  type: 'connect-prompt';
  /** Echoed when the agent asked for one specific provider and it is connectable. */
  requestedProvider?: string;
  providers: ConnectPromptProvider[];
}

export interface ConnectPromptInputs {
  catalog: IntegrationCatalogEntry[];
  connections: ProjectConnection[];
}

/**
 * Builds the built-in tool that lets an agent prompt the end user to connect
 * a provider account mid-conversation. Only added to resource-scoped
 * resolutions: without an end-user identity there is nobody to scope a new
 * connection to.
 *
 * The connectable set respects the developer's configuration: the `providers`
 * allowlist from `tools()` when one was given, otherwise every provider in
 * the platform catalog.
 *
 * `loadInputs` is called per tool invocation so connection state is fresh —
 * after the user connects through the rendered card, the agent can call the
 * tool again and see `connected: true` without waiting out the snapshot TTL.
 */
export function buildConnectPromptTool({
  loadInputs,
  only,
  resourceId,
}: {
  loadInputs: () => Promise<ConnectPromptInputs>;
  /** Allowlisted provider ids from the `providers` array option; undefined = full catalog. */
  only: Set<string> | undefined;
  resourceId: string;
}) {
  return createTool({
    id: CONNECT_PROMPT_TOOL_KEY,
    description:
      'Ask the current user to connect a provider account (e.g. Linear, Slack). ' +
      'Call this when a task needs a provider whose tools are unavailable because no account is connected, ' +
      'or when the user asks to connect one. The result renders as a connect prompt in the UI — ' +
      'tell the user to use it, and do not fabricate links. ' +
      'Pass `provider` to request one specific provider; omit it to list everything the user can connect.',
    inputSchema: z.object({
      provider: z
        .string()
        .optional()
        .describe('Provider id to request (e.g. "linear"). Omit to list all connectable providers.'),
    }),
    execute: async (input): Promise<ConnectPromptPayload> => {
      const { catalog, connections } = await loadInputs();

      // Provider ids are compared case-insensitively: the allowlist keeps the
      // caller's casing while catalog ids are platform-defined.
      const allow = only === undefined ? undefined : new Set(Array.from(only, id => id.toLowerCase()));
      const connectable = catalog.filter(entry => allow === undefined || allow.has(entry.id.toLowerCase()));
      const toProvider = (entry: IntegrationCatalogEntry): ConnectPromptProvider => {
        const usable = connections.filter(
          connection =>
            connection.integrationId.toLowerCase() === entry.id.toLowerCase() && connection.status === 'active',
        );
        const own = usable.some(connection => connection.resourceId === resourceId);
        return {
          id: entry.id,
          displayName: entry.displayName ?? null,
          logoUrl: entry.logoUrl ?? null,
          authType: entry.authType ?? null,
          connected: usable.length > 0,
          scope: own ? 'user' : usable.length > 0 ? 'global' : null,
        };
      };

      const requestedId = input.provider?.toLowerCase();
      const requested =
        requestedId === undefined ? undefined : connectable.find(entry => entry.id.toLowerCase() === requestedId);
      if (requested) {
        return { type: 'connect-prompt', requestedProvider: requested.id, providers: [toProvider(requested)] };
      }
      // Unknown or omitted provider: return the full connectable set so the
      // agent can correct itself instead of failing.
      return { type: 'connect-prompt', providers: connectable.map(toProvider) };
    },
  });
}
