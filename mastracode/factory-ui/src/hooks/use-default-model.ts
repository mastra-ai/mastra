import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { DefaultModelResponse } from '../api/types';
import { useOptimisticFieldWrite } from './optimistic-field-write';

export function defaultModelQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.defaultModel(),
    queryFn: () => client.get<DefaultModelResponse>('/web/config/default-model'),
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

type PersonalDefaultField = Exclude<keyof DefaultModelResponse, 'modelId'>;

function useSetPersonalDefault<F extends PersonalDefaultField>(field: F, path: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useOptimisticFieldWrite<DefaultModelResponse, F, Pick<DefaultModelResponse, F>>({
    queryKey: queryKeys.defaultModel(),
    field,
    write: value => client.put<Pick<DefaultModelResponse, F>>(path, { [field]: value }),
    savedValue: saved => saved[field],
    onSaved: () => queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
  });
}

export function useSetDefaultThinkingLevel() {
  return useSetPersonalDefault('thinkingLevel', '/web/config/default-model/thinking');
}

export function useSetDefaultFallbackModels() {
  return useSetPersonalDefault('fallbackModelIds', '/web/config/default-model/fallbacks');
}

export interface ApplyDefaultModelResponse {
  modelId: string;
  applied: string[];
  skipped: Array<{ sessionId: string; reason: 'not-running' | 'thread-missing' | 'factory-scope' | 'apply-failed' }>;
}

export function useApplyDefaultModel() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: () => client.post<ApplyDefaultModelResponse>('/web/config/default-model/apply', {}),
  });
}

export function useClearDefaultModel() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.del<{ ok: true; modelId: null }>('/web/config/default-model'),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.defaultModel() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}
