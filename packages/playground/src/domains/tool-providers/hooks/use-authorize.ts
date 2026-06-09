import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

export interface AuthorizeArgs {
  providerId: string;
  toolkit: string;
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
   * Optional human label to persist on the resulting `tool_integration_connections` row.
   */
  label?: string | null;
  /**
   * Ownership scope of the OAuth bucket. `'per-author'` (default) buckets
   * under the caller's authorId.
   */
  scope?: 'per-author' | 'shared' | 'caller-supplied';
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
  pollIntervalMs?: number;
  timeoutMs?: number;
  openPopup?: (url: string) => Window | null;
}

/**
 * Drives the OAuth popup + polling loop for a `ToolProvider` provider.
 */
export const useAuthorize = (options: UseAuthorizeOptions = {}) => {
  const client = useMastraClient();
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const openPopup = options.openPopup ?? ((url: string) => window.open(url, '_blank', 'popup,width=600,height=700'));

  return useMutation<AuthorizeResult, Error, AuthorizeArgs>({
    mutationFn: async ({ providerId, toolkit, connectionId, config, label, scope }) => {
      const integration = client.getToolProvider(providerId);
      const { url, authId } = await integration.authorize({
        toolkit,
        ...(connectionId ? { connectionId } : {}),
        ...(config ? { config } : {}),
        ...(label !== undefined ? { label } : {}),
        ...(scope ? { scope } : {}),
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
