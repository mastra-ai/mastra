import { toast } from '@mastra/playground-ui/utils/toast';
import { useConnectChannel } from '@mastra/react/hooks';
import { useCallback } from 'react';

/**
 * Wraps {@link useConnectChannel} with the standard UI side-effects shared by every
 * "connect this agent to a channel" surface in the app:
 *
 * - `oauth` → redirect the current tab to the authorization URL
 * - `deep_link` → open the URL in a new tab; toast on popup-blocker
 * - `immediate` → nothing (the installations query is invalidated by the underlying mutation)
 *
 * Errors surface as toasts. Pass `onClose` if the calling surface should close itself
 * after a `deep_link` or `immediate` result (used by the publish dialog).
 */
export const useConnectChannelAction = (platform: string, opts: { onClose?: () => void } = {}) => {
  const { mutate, isPending } = useConnectChannel({ platform: platform });
  const { onClose } = opts;

  const connect = useCallback(
    (agentId: string) => {
      mutate(
        { agentId },
        {
          onSuccess: result => {
            switch (result.type) {
              case 'oauth':
                window.location.href = result.authorizationUrl;
                return;
              case 'deep_link': {
                const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
                if (!popup) {
                  toast.error('Popup blocked — please allow popups and try again');
                }
                onClose?.();
                return;
              }
              case 'immediate':
                onClose?.();
                return;
            }
          },
          onError: (err: Error & { body?: { error?: string } }) => {
            toast.error(err.body?.error || err.message || 'Failed to connect channel');
          },
        },
      );
    },
    [mutate, onClose],
  );

  return { connect, isConnecting: isPending };
};
