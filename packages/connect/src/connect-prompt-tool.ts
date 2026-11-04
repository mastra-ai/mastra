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
  /** Fields the UI must collect before starting headless authorization. */
  authFields: NonNullable<IntegrationCatalogEntry['authFields']> | null;
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
  /** Outcome for the model once a paused prompt resumes, e.g. "Linear connected successfully." */
  message?: string;
  /** Why the connection failed, as the chat UI reported it, when a paused prompt resumes without one. */
  error?: string;
}

/**
 * What a chat UI resumes a paused `request_connection` call with once the
 * user's connection settles: `active`, or `failed` with the reason the UI saw
 * (closed window, rejected credentials, connection limit). The tool re-checks
 * the platform rather than trusting it, so a stale or forged resume can't
 * report a false success, and a failure that raced a success reports success.
 */
export const connectPromptResumeSchema = z.discriminatedUnion('status', [
  z.object({ provider: z.string().min(1), status: z.literal('active') }),
  z.object({ provider: z.string().min(1), status: z.literal('failed'), error: z.string().trim().min(1).max(500) }),
]);

export type ConnectPromptResume = z.infer<typeof connectPromptResumeSchema>;

export interface ConnectPromptInputs {
  catalog: IntegrationCatalogEntry[];
  connections: ProjectConnection[];
  /** Effective code or project allowlist; undefined means the full catalog. */
  allowlist: Set<string> | undefined;
}

/**
 * Builds the built-in tool that lets an agent prompt the end user to connect
 * a provider account mid-conversation. Only added to resource-scoped
 * resolutions: without an end-user identity there is nobody to scope a new
 * connection to.
 *
 * The connectable set respects the effective project policy: an explicit
 * `tools({ providers })` allowlist wins, otherwise the project's provider
 * configuration is loaded from Mastra Platform.
 *
 * `loadInputs` is called per tool invocation so provider policy and connection state are fresh —
 * after the user connects through the rendered card, the agent can call the
 * tool again and see `connected: true` without waiting out the snapshot TTL.
 */
export function buildConnectPromptTool({
  loadInputs,
  resourceId,
}: {
  loadInputs: () => Promise<ConnectPromptInputs>;
  resourceId: string;
}) {
  return createTool({
    id: CONNECT_PROMPT_TOOL_KEY,
    description:
      'Ask the current user to connect a provider account (e.g. Linear, Slack). ' +
      'Call this when a task needs a provider whose tools are unavailable because no account is connected, ' +
      'or when the user asks to connect one. Do not fabricate links. Pass `provider` to request one ' +
      'specific provider: the call renders a connect prompt in the UI and waits until the user connects, ' +
      'and its result then says whether the connection succeeded or why it failed. Omit `provider` to list everything the ' +
      'user can connect without waiting; an unknown provider also returns that list.',
    inputSchema: z.object({
      provider: z
        .string()
        .optional()
        .describe('Provider id to request (e.g. "linear"). Omit to list all connectable providers.'),
    }),
    resumeSchema: connectPromptResumeSchema,
    execute: async (input, context): Promise<ConnectPromptPayload> => {
      const { catalog, connections, allowlist } = await loadInputs();

      // Provider ids are compared case-insensitively because catalog ids are
      // platform-defined while code configuration may use different casing.
      const allow = allowlist === undefined ? undefined : new Set(Array.from(allowlist, id => id.toLowerCase()));
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
          authFields: entry.authFields ?? null,
          connected: usable.length > 0,
          scope: own ? 'user' : usable.length > 0 ? 'global' : null,
        };
      };

      const requestedId = input.provider?.toLowerCase();
      const requested =
        requestedId === undefined ? undefined : connectable.find(entry => entry.id.toLowerCase() === requestedId);
      // Unknown or omitted provider: list the full connectable set so the
      // agent can correct itself instead of failing.
      const payload: ConnectPromptPayload = requested
        ? { type: 'connect-prompt', requestedProvider: requested.id, providers: [toProvider(requested)] }
        : { type: 'connect-prompt', providers: connectable.map(toProvider) };

      const agent = context?.agent;
      const resumed = agent?.resumeData as ConnectPromptResume | undefined;
      if (resumed) {
        const provider = payload.providers.find(entry => entry.id.toLowerCase() === resumed.provider.toLowerCase());
        const name = provider?.displayName ?? resumed.provider;
        if (provider?.connected) return { ...payload, message: `${name} connected successfully.` };
        if (resumed.status === 'failed') {
          return { ...payload, message: `${name} could not be connected: ${resumed.error}`, error: resumed.error };
        }
        return { ...payload, message: `${name} is not connected yet.` };
      }

      // Only a specific, not-yet-connected provider is worth waiting for. An
      // omitted or unknown provider returns the list right away so the agent
      // can correct itself, and a connected one already works.
      if (!requested || payload.providers[0]?.connected) return payload;

      // Pause the run until the user connects; the chat UI resumes it with the
      // settled provider so the agent continues without a user message.
      // Outside an agent run there is nothing to resume, so return the prompt.
      if (agent?.suspend) await agent.suspend(payload);
      return payload;
    },
  });
}
