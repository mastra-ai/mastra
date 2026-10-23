import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { DefaultModelResponse } from '../api/types';

export function useDefaultModelQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery({
    enabled,
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
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.defaultModel() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}

export function useSetDefaultThinkingLevel() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.defaultModel();

  return useMutation({
    // One write at a time, so a rollback restores the value before that write.
    scope: { id: 'personal-thinking-default' },
    mutationFn: (thinkingLevel: ThinkingLevelSetting | null) =>
      client.put<{ ok: true; thinkingLevel: ThinkingLevelSetting | null }>('/web/config/default-model/thinking', {
        thinkingLevel,
      }),
    onMutate: async thinkingLevel => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<DefaultModelResponse>(key);
      if (previous) queryClient.setQueryData<DefaultModelResponse>(key, { ...previous, thinkingLevel });
      return { previous };
    },
    onError: (_error, _thinkingLevel, context) => {
      if (context?.previous) {
        const { thinkingLevel } = context.previous;
        queryClient.setQueryData<DefaultModelResponse>(key, current =>
          current ? { ...current, thinkingLevel } : current,
        );
      }
      return queryClient.invalidateQueries({ queryKey: key, exact: true });
    },
    onSuccess: ({ thinkingLevel }) => {
      queryClient.setQueryData<DefaultModelResponse>(key, previous =>
        previous ? { ...previous, thinkingLevel } : previous,
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() });
    },
  });
}

export interface ApplyDefaultModelResponse {
  modelId: string;
  applied: string[];
  skipped: Array<{ sessionId: string; reason: 'not-running' | 'thread-missing' | 'apply-failed' }>;
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
