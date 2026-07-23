import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  disconnectChannelAccount,
  listChannelAccounts,
  setDefaultFactoryAccount,
} from '../../web/ui/domains/settings/services/channelAccounts';
import type { ConnectedChannelAccount } from '../../web/ui/domains/settings/services/channelAccounts';

/**
 * The caller's linked channel accounts (Settings › Connected accounts), plus
 * whether the web-initiated Slack connect flow is available.
 */
export function useChannelAccountsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.channelAccounts(),
    queryFn: () => listChannelAccounts(baseUrl),
  });
}

/** Point one of the caller's links at a Factory project; refreshes the list. */
export function useSetDefaultFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      factoryProjectId,
      ...key
    }: Pick<ConnectedChannelAccount, 'platform' | 'externalTeamId' | 'externalUserId'> & {
      factoryProjectId: string | null;
    }) => setDefaultFactoryAccount(baseUrl, key, factoryProjectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.channelAccounts() });
    },
  });
}

/** Sever one of the caller's links; refreshes the list on success. */
export function useDisconnectChannelAccountMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: Pick<ConnectedChannelAccount, 'platform' | 'externalTeamId' | 'externalUserId'>) =>
      disconnectChannelAccount(baseUrl, key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.channelAccounts() });
    },
  });
}
