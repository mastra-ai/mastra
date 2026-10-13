import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { DefaultModelResponse } from '../api/types';

export function useDefaultModelQuery() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.defaultModel(),
    queryFn: () => client.get<DefaultModelResponse>('/web/config/default-model'),
  });
}

export function useSetDefaultModel() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) =>
      client.put<{ ok: true; modelId: string }>('/web/config/default-model', { modelId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.defaultModel() }),
  });
}

export function useClearDefaultModel() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.del<{ ok: true; modelId: null }>('/web/config/default-model'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.defaultModel() }),
  });
}
