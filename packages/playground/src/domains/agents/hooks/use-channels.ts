import type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
