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
      const body = await client.get<CustomProvidersResponse>('/web/config/custom-providers');
      return body.providers;
    },
  });
}

// A custom provider is also a row in the provider catalogue and its models
// appear in the model list, so both refetch alongside the custom list.
function invalidateCustomProviderQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
  ]);
}

export function useSaveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveCustomProviderBody) =>
      client.post<{ ok: true; provider?: CustomProviderInfo }>('/web/config/custom-providers', body),
    onSuccess: () => invalidateCustomProviderQueries(queryClient),
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
      client.del<OkResponse>(`/web/config/custom-providers/${encodeURIComponent(id)}`),
    onSuccess: () => invalidateCustomProviderQueries(queryClient),
  });
}
