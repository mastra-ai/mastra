import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  CompleteProviderOAuthBody,
  CompleteProviderOAuthResponse,
  ProviderInfo,
  ProvidersResponse,
  SaveProviderKeyResponse,
  StartProviderOAuthResponse,
} from '../api/types';

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
  return useQuery<ProvidersResponse>({
    queryKey: queryKeys.providers(),
    queryFn: () => client.get<ProvidersResponse>('/web/config/providers'),
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

export interface StartProviderOAuthArgs {
  provider: string;
}

export function useStartProviderOAuth() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: ({ provider }: StartProviderOAuthArgs) =>
      client.post<StartProviderOAuthResponse>(`/web/config/providers/${encodeURIComponent(provider)}/oauth/start`),
  });
}

export interface CompleteProviderOAuthArgs extends CompleteProviderOAuthBody {
  provider: string;
}

export function useCompleteProviderOAuth() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, loginId, code }: CompleteProviderOAuthArgs) =>
      client.post<CompleteProviderOAuthResponse>(
        `/web/config/providers/${encodeURIComponent(provider)}/oauth/complete`,
        { loginId, code },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
  });
}

export interface RemoveProviderOAuthArgs {
  provider: string;
}

export function useRemoveProviderOAuth() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider }: RemoveProviderOAuthArgs) =>
      client.del<SaveProviderKeyResponse>(`/web/config/providers/${encodeURIComponent(provider)}/oauth`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
  });
}
