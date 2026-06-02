import type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult };

export const useChannelPlatforms = () => {
  const client = useMastraClient();

  return useQuery<ChannelPlatformInfo[]>({
    queryKey: ['channels', 'platforms'],
    queryFn: () => client.channels.listPlatforms(),
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useChannelInstallations = (platform: string, agentId: string) => {
  const client = useMastraClient();

  return useQuery<ChannelInstallationInfo[]>({
    queryKey: ['channels', 'installations', platform, agentId],
    queryFn: () => client.channels.listInstallations(platform, agentId),
    enabled: Boolean(platform && agentId),
    staleTime: 10 * 1000,
    retry: false,
  });
};

export const useConnectChannel = (platform: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ChannelConnectResult, Error, { agentId: string; options?: Record<string, unknown> }>({
    mutationFn: ({ agentId, options }) =>
      client.channels.connect(platform, agentId, {
        ...options,
        // Tell the server to redirect back here after OAuth
        redirectUrl: window.location.href,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', 'installations', platform] });
    },
  });
};

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
  const { mutate, isPending } = useConnectChannel(platform);
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

export const useDisconnectChannel = (platform: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: agentId => client.channels.disconnect(platform, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', 'installations', platform] });
    },
  });
};
