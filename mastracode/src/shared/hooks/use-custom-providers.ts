import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { CustomProviderInfo, CustomProvidersResponse, OkResponse, SaveCustomProviderBody } from '../api/types';

/**
 * User-defined OpenAI-compatible providers (mirrors the TUI `/custom-providers`
 * command). Backed by global settings on the server. The API key is write-only;
 * the server only ever reports `hasApiKey`.
 */
export function useCustomProvidersQuery() {
  const { client } = useApiConfig();
  return useQuery<CustomProviderInfo[]>({
    queryKey: queryKeys.customProviders(),
    queryFn: async () => {
      const body = await client.get<CustomProvidersResponse>('/api/web/config/custom-providers');
      return body.providers;
    },
  });
}

export function useSaveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveCustomProviderBody) =>
      client.post<{ ok: true; provider?: CustomProviderInfo }>('/api/web/config/custom-providers', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
  });
}

export interface RemoveCustomProviderArgs {
  id: string;
}

export function useRemoveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveCustomProviderArgs) =>
      client.del<OkResponse>(`/api/web/config/custom-providers/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
  });
}
