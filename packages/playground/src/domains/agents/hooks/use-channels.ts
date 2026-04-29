import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ChannelPlatformInfo {
  id: string;
  name: string;
  isConfigured: boolean;
}

export interface ChannelInstallationInfo {
  id: string;
  platform: string;
  agentId: string;
  status: 'active' | 'pending';
  displayName?: string;
  installedAt?: string;
}

export interface ChannelConnectResult {
  authorizationUrl: string;
  installationId: string;
  appId: string;
}

export const useChannelPlatforms = () => {
  const client = useMastraClient();

  return useQuery<ChannelPlatformInfo[]>({
    queryKey: ['channels', 'platforms'],
    queryFn: () => client.request<ChannelPlatformInfo[]>('/channels/platforms'),
    staleTime: 60 * 1000,
    retry: false,
  });
};

export const useChannelInstallations = (platform: string, agentId: string) => {
  const client = useMastraClient();

  return useQuery<ChannelInstallationInfo[]>({
    queryKey: ['channels', 'installations', platform, agentId],
    queryFn: async () => {
      const all = await client.request<ChannelInstallationInfo[]>(`/channels/${platform}/installations`);
      return all.filter(i => i.agentId === agentId);
    },
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
      client.request<ChannelConnectResult>(`/channels/${platform}/connect`, {
        method: 'POST',
        body: {
          agentId,
          options: {
            ...options,
            // Tell the server to redirect back here after OAuth
            redirectUrl: window.location.href,
          },
        } as any,
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
    mutationFn: agentId =>
      client.request<{ success: boolean }>(`/channels/${platform}/${agentId}/disconnect`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', 'installations', platform] });
    },
  });
};
