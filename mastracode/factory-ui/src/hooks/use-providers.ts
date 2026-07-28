import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  OAuthPollResponse,
  OAuthStartResponse,
  ProviderInfo,
  ProvidersResponse,
  SaveProviderKeyResponse,
} from '../api/types';

/**
 * Providers + API-key management (mirrors the TUI `/api-keys` command).
 *
 * React Query owns the cache: the list is fetched once and deduped across
 * consumers, and the save/remove mutations invalidate the list so it refetches
 * the server's source of truth instead of optimistic local edits. Keys are
 * write-only — never read back.
 */
/**
 * A credential change (key saved/removed, OAuth completed, signed out) alters
 * which models are runnable, so the model catalog and the credential-gated
 * model packs must refetch along with the provider list.
 */
function invalidateCredentialDependentQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.modelPacksAll() }),
  ]);
}

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
  scope?: 'user' | 'org';
}

export function useSaveProviderKey() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, key, envVar, scope }: SaveProviderKeyArgs) =>
      client.put<SaveProviderKeyResponse>(`/web/config/providers/${encodeURIComponent(provider)}/key`, {
        key,
        ...(envVar !== undefined ? { envVar } : {}),
        ...(scope !== undefined ? { scope } : {}),
      }),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export interface RemoveProviderKeyArgs {
  provider: string;
  scope?: 'user' | 'org';
}

export function useRemoveProviderKey() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, scope }: RemoveProviderKeyArgs) =>
      client.del<SaveProviderKeyResponse>(
        `/web/config/providers/${encodeURIComponent(provider)}/key${scope ? `?scope=${scope}` : ''}`,
      ),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export interface ProviderOAuthArgs {
  provider: string;
}

export interface StartProviderOAuthArgs extends ProviderOAuthArgs {
  mode?: string;
}

export function useStartProviderOAuth() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: ({ provider, mode }: StartProviderOAuthArgs) =>
      client.post<OAuthStartResponse>(`/web/config/providers/${encodeURIComponent(provider)}/oauth/start`, {
        ...(mode !== undefined ? { mode } : {}),
      }),
  });
}

export interface CompleteProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
  code: string;
}

export function useCompleteProviderOAuth() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, sessionId, code }: CompleteProviderOAuthArgs) =>
      client.post<{ status: 'complete' }>(`/web/config/providers/${encodeURIComponent(provider)}/oauth/complete`, {
        sessionId,
        code,
      }),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export interface PollProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
}

export function usePollProviderOAuth() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, sessionId }: PollProviderOAuthArgs) =>
      client.post<OAuthPollResponse>(`/web/config/providers/${encodeURIComponent(provider)}/oauth/poll`, {
        sessionId,
      }),
    onSuccess: response => {
      if (response.status === 'complete') {
        return invalidateCredentialDependentQueries(queryClient);
      }
    },
  });
}

export interface CancelProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
}

export function useCancelProviderOAuth() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: ({ provider, sessionId }: CancelProviderOAuthArgs) =>
      client.del<{ ok: true }>(
        `/web/config/providers/${encodeURIComponent(provider)}/oauth/session/${encodeURIComponent(sessionId)}`,
      ),
  });
}

export function useSignOutProviderOAuth() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider }: ProviderOAuthArgs) =>
      client.del<{ ok: true }>(`/web/config/providers/${encodeURIComponent(provider)}/oauth`),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}
