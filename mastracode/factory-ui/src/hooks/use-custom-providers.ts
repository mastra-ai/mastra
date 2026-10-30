import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { CustomProviderInfo, CustomProvidersResponse, OkResponse, SaveCustomProviderBody } from '../api/types';

/**
 * Organization-scoped OpenAI-compatible providers. The API key is write-only;
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

export function useSaveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveCustomProviderBody) =>
      client.post<{ ok: true; provider: CustomProviderInfo }>('/web/config/custom-providers', body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
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
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}
