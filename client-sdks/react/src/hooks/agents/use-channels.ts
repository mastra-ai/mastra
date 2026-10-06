import type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult };

export const useChannelPlatforms = <TData = ChannelPlatformInfo[]>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ChannelPlatformInfo[], TData> } = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ChannelPlatformInfo[], Error, TData>({
    queryKey: ['channels', 'platforms'],
    queryFn: () => client.channels.listPlatforms(),
    staleTime: 60 * 1000,
    retry: false,
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useChannelInstallations = <TData = ChannelInstallationInfo[]>({
  platform,
  agentId,
  queryOptions,
}: {
  platform: string;
  agentId: string;
  queryOptions?: MastraQueryOptions<ChannelInstallationInfo[], TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ChannelInstallationInfo[], Error, TData>({
    queryKey: ['channels', 'installations', platform, agentId],
    queryFn: () => client.channels.listInstallations(platform, agentId),
    staleTime: 10 * 1000,
    retry: false,
    ...queryOptions,
  });
};

/**
 * Reconcile an agent's installation with platform state — activates a pending
 * installation whose connect flow completed out-of-band (e.g. a Discord bot
 * invite finished in another tab). Resolves null on platforms without
 * reconciliation. Call it deliberately (e.g. on window focus while a connect
 * is in flight) — it is a write, not a read.
 */
export const useReconcileChannelInstallation = ({
  platform,
  queryOptions,
}: {
  platform: string;
  queryOptions?: MastraMutationOptions<ChannelInstallationInfo | null, string>;
}): UseMutationResult<ChannelInstallationInfo | null, Error, string> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ChannelInstallationInfo | null, Error, string>({
    mutationFn: agentId => client.channels.reconcileInstallation(platform, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', 'installations', platform] });
    },
    ...queryOptions,
  });
};

export const useConnectChannel = ({
  platform,
  queryOptions,
}: {
  platform: string;
  queryOptions?: MastraMutationOptions<ChannelConnectResult, { agentId: string; options?: Record<string, unknown> }>;
}): UseMutationResult<ChannelConnectResult, Error, { agentId: string; options?: Record<string, unknown> }> => {
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
    ...queryOptions,
  });
};

export const useDisconnectChannel = ({
  platform,
  queryOptions,
}: {
  platform: string;
  queryOptions?: MastraMutationOptions<{ success: boolean }, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: agentId => client.channels.disconnect(platform, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', 'installations', platform] });
    },
    ...queryOptions,
  });
};
