import { toast } from '@mastra/playground-ui/utils/toast';
import { useConnectChannel } from '@mastra/react/hooks/agents';
import { useCallback } from 'react';

/**
 * Wraps {@link useConnectChannel} with the standard UI side-effects shared by every
 * "connect this agent to a channel" surface in the app:
 *
 * - `oauth` → open the authorization URL in a new tab; toast on popup-blocker. A new
 *   tab (not a same-tab redirect) because some providers cannot redirect back to an
 *   arbitrary studio origin (e.g. Discord's bot-invite flow strands the user on
 *   Discord's success page). Keeping this tab alive means returning to it fires the
 *   window-focus refetch of the installations query, which lets the server reconcile
 *   a completed invite and flip the install to "Connected" without a callback.
 * - `deep_link` → open the URL in a new tab; toast on popup-blocker
 * - `immediate` → nothing (the installations query is invalidated by the underlying mutation)
 *
 * The tab is opened synchronously in the click handler — while the click's transient
 * user activation is still live — and navigated once the connect request resolves.
 * Calling `window.open` from the async mutation callback would risk the popup
 * blocker if the request outlives the activation window. It is opened WITHOUT the
 * `noopener` feature (which makes `window.open` return `null` even on success, so a
 * blocked popup would be indistinguishable from an open one); the opener link is
 * severed manually instead.
 *
 * Errors surface as toasts. Pass `onClose` if the calling surface should close itself
 * after a `deep_link` or `immediate` result (used by the publish dialog).
 */
export const useConnectChannelAction = (platform: string, opts: { onClose?: () => void } = {}) => {
  const { mutate, isPending } = useConnectChannel({ platform: platform });
  const { onClose } = opts;

  const connect = useCallback(
    (agentId: string) => {
      const tab = window.open('about:blank', '_blank');
      if (tab) {
        tab.opener = null;
      }

      mutate(
        { agentId },
        {
          onSuccess: result => {
            switch (result.type) {
              case 'oauth':
              case 'deep_link': {
                const url = result.type === 'oauth' ? result.authorizationUrl : result.url;
                if (tab) {
                  tab.location.href = url;
                } else {
                  toast.error('Popup blocked — please allow popups and try again');
                }
                onClose?.();
                return;
              }
              case 'immediate':
                tab?.close();
                onClose?.();
                return;
            }
          },
          onError: (err: Error & { body?: { error?: string } }) => {
            tab?.close();
            toast.error(err.body?.error || err.message || 'Failed to connect channel');
          },
        },
      );
    },
    [mutate, onClose],
  );

  return { connect, isConnecting: isPending };
};
