import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ProviderAccountsResponse } from '../api/types';

export type AccountScope = 'user' | 'org';

function accountsPath(provider: string, suffix = '') {
  return `/web/config/providers/${encodeURIComponent(provider)}/accounts${suffix}`;
}

function accountPath(provider: string, accountId: string, suffix = '') {
  return accountsPath(provider, `/${encodeURIComponent(accountId)}${suffix}`);
}

/** A provider's account pool at one scope, in routing order (lowest priority tried first). */
export function useProviderAccountsQuery(provider: string, scope: AccountScope, enabled = true) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.providerAccounts(provider, scope),
    queryFn: () => client.get<ProviderAccountsResponse>(`${accountsPath(provider)}?scope=${scope}`),
    select: (body: ProviderAccountsResponse) =>
      body.accounts.toSorted((left, right) => left.priority - right.priority || left.createdAt - right.createdAt),
    enabled,
    // Older servers have no pool routes; the row falls back to the single-credential view.
    retry: false,
  });
}

/**
 * Every pool mutation answers with the whole pool, so the cache is replaced
 * from the response. Providers and models refetch too: the active account
 * decides which credential runs.
 */
function usePoolMutation<TArgs>(
  provider: string,
  scope: AccountScope,
  send: (args: TArgs) => Promise<ProviderAccountsResponse>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: body => {
      queryClient.setQueryData(queryKeys.providerAccounts(provider, scope), body);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.providers(), exact: true }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]);
    },
  });
}

export function useActivateProviderAccount(provider: string, scope: AccountScope) {
  const { client } = useApiConfig();
  return usePoolMutation(provider, scope, (accountId: string) =>
    client.post<ProviderAccountsResponse>(`${accountPath(provider, accountId, '/activate')}?scope=${scope}`),
  );
}

export function useRenameProviderAccount(provider: string, scope: AccountScope) {
  const { client } = useApiConfig();
  return usePoolMutation(provider, scope, ({ accountId, label }: { accountId: string; label: string }) =>
    client.patch<ProviderAccountsResponse>(`${accountPath(provider, accountId)}?scope=${scope}`, { label }),
  );
}

export function useRemoveProviderAccount(provider: string, scope: AccountScope) {
  const { client } = useApiConfig();
  return usePoolMutation(provider, scope, (accountId: string) =>
    client.del<ProviderAccountsResponse>(`${accountPath(provider, accountId)}?scope=${scope}`),
  );
}

export function useReorderProviderAccounts(provider: string, scope: AccountScope) {
  const { client } = useApiConfig();
  return usePoolMutation(provider, scope, (orderedIds: string[]) =>
    client.put<ProviderAccountsResponse>(`${accountsPath(provider, '/order')}?scope=${scope}`, { orderedIds }),
  );
}
