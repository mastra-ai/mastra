import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

export interface AuthorizeArgs {
  integrationId: string;
  toolService: string;
  /**
   * Existing bucket id when re-authorizing; omit for a brand-new connection.
   * Semantics are provider-opaque; for Composio v1 this is the internal user
   * bucket the new connected account should be created under.
   */
  connectionId?: string;
  /**
   * Provider-specific connection fields collected from the picker (e.g.
   * Confluence subdomain). Forwarded to the server's `authorize` body.
   */
  config?: Record<string, unknown>;
  /**
   * Optional human label to persist on the resulting `tool_connections` row.
   * Stored once per (authorId, providerId, connectionId) and surfaced across
   * agents in the picker so the same account doesn't need to be relabeled.
   */
  label?: string | null;
}

export interface AuthorizeResult {
  status: 'completed' | 'failed';
  /**
   * The `authId` returned by `authorize`, exposed as `connectionId` because
   * for the v1 Composio adapter it is the `connected_account.id` that the
   * caller persists as `Connection.connectionId`.
   */
  connectionId: string;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export interface UseAuthorizeOptions {
  /** Override poll interval in ms (used by tests). */
  pollIntervalMs?: number;
  /** Override timeout in ms (used by tests). */
  timeoutMs?: number;
  /** Injection seam for the popup opener (used by tests). */
  openPopup?: (url: string) => Window | null;
}

/**
 * Drives the OAuth popup + polling loop for a `ToolIntegration` provider.
 *
 * Calls `POST /authorize` to get a redirect URL, opens it in a popup, then
 * polls `GET /auth-status/:authId` until the flow resolves. Resolves with
 * `{ status, authId }` on success. The caller is responsible for persisting
 * `authId` as the new `Connection.connectionId` on a successful flow.
 */
export const useAuthorize = (options: UseAuthorizeOptions = {}) => {
  const client = useMastraClient();
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const openPopup = options.openPopup ?? ((url: string) => window.open(url, '_blank', 'popup,width=600,height=700'));

  return useMutation<AuthorizeResult, Error, AuthorizeArgs>({
    mutationFn: async ({ integrationId, toolService, connectionId, config, label }) => {
      const integration = client.getToolIntegration(integrationId);
      const { url, authId } = await integration.authorize({
        toolService,
        connectionId: connectionId ?? '',
        ...(config ? { config } : {}),
        ...(label !== undefined ? { label } : {}),
      });

      const popup = openPopup(url);
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        const { status } = await integration.getAuthStatus(authId);
        if (status === 'completed' || status === 'failed') {
          try {
            popup.close();
          } catch {
            // Cross-origin popups may refuse close(); ignore.
          }
          return { status, connectionId: authId };
        }
      }

      try {
        popup.close();
      } catch {
        // ignore
      }
      throw new Error('Authorization timed out');
    },
  });
};
