import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ProviderInfo, ProvidersResponse, SaveProviderKeyResponse } from '../api/types';

/**
 * Providers + API-key management (mirrors the TUI `/api-keys` command).
 *
 * React Query owns the cache: the list is fetched once and deduped across
 * consumers, and the save/remove mutations invalidate the list so it refetches
 * the server's source of truth instead of optimistic local edits. Keys are
 * write-only — never read back.
 */
export function useProvidersQuery() {
  const { client } = useApiConfig();
  return useQuery<ProviderInfo[]>({
    queryKey: queryKeys.providers(),
    queryFn: async () => {
      const body = await client.get<ProvidersResponse>('/web/config/providers');
      return body.providers;
    },
  });
}

export interface SaveProviderKeyArgs {
  provider: string;
  key: string;
  envVar?: string;
}

export function useSaveProviderKey() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, key, envVar }: SaveProviderKeyArgs) =>
      client.put<SaveProviderKeyResponse>(
        `/web/config/providers/${encodeURIComponent(provider)}/key`,
        envVar !== undefined ? { key, envVar } : { key },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
  });
}

export interface RemoveProviderKeyArgs {
  provider: string;
}

export function useRemoveProviderKey() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider }: RemoveProviderKeyArgs) =>
      client.del<SaveProviderKeyResponse>(`/web/config/providers/${encodeURIComponent(provider)}/key`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
  });
}
