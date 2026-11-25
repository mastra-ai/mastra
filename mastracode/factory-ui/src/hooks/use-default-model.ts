import type { ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export function defaultModelQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.defaultModel(),
    queryFn: () => client.get<PersonalModelDefaultsResponse>('/web/config/default-model'),
  });
}

export function useDefaultModelQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery({ ...defaultModelQueryOptions(client), enabled });
}

export function useSetDefaultModel() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) =>
      client.put<{ ok: true; modelId: string }>('/web/config/default-model', { modelId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.defaultModel() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}

export function useSetPersonalModelPacks() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (set: ModelPackSet) => client.put<PersonalModelDefaultsResponse>('/web/config/model-packs', set),
    onSuccess: saved => {
      queryClient.setQueryData(queryKeys.defaultModel(), saved);
      return queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() });
    },
  });
}
