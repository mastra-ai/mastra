import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { TitleGenerationConfigInfo, UpdateTitleGenerationConfigResponse } from '../api/types';

/**
 * Org-scoped automatic thread-title generation — the on/off switch plus the
 * optional writer model used to name otherwise-untitled threads. Mirrors
 * `GET/PUT /web/config/title-generation`. The mutation returns the refreshed
 * config, so it patches the cache via `setQueryData` instead of refetching.
 */
export function useTitleGenerationQuery() {
  const { client } = useApiConfig();
  return useQuery<TitleGenerationConfigInfo>({
    queryKey: queryKeys.titleGeneration(),
    queryFn: () => client.get<TitleGenerationConfigInfo>('/web/config/title-generation'),
  });
}

export interface UpdateTitleGenerationArgs {
  enabled?: boolean;
  /** A model id pins the writer; `null` falls back to the provider-aware default. */
  modelId?: string | null;
  thinkingLevel?: TitleGenerationConfigInfo['thinkingLevel'];
}

/**
 * Optimistic update: the toggle/pickers reflect the click immediately, roll
 * back to the previous config when the write fails (the section surfaces the
 * error), and re-sync with the server once it settles.
 */
export function useUpdateTitleGenerationMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateTitleGenerationArgs) =>
      client.put<UpdateTitleGenerationConfigResponse>('/web/config/title-generation', args),
    onMutate: async args => {
      await queryClient.cancelQueries({ queryKey: queryKeys.titleGeneration() });
      const previous = queryClient.getQueryData<TitleGenerationConfigInfo>(queryKeys.titleGeneration());
      queryClient.setQueryData<TitleGenerationConfigInfo>(queryKeys.titleGeneration(), prev =>
        prev
          ? {
              enabled: args.enabled ?? prev.enabled,
              modelId: args.modelId !== undefined ? args.modelId : prev.modelId,
              thinkingLevel: args.thinkingLevel !== undefined ? args.thinkingLevel : prev.thinkingLevel,
            }
          : prev,
      );
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.titleGeneration(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.titleGeneration() }),
  });
}

/**
 * Regenerate the title of one session's active thread on demand — names the
 * thread from its first user message even when the auto toggle is off. The
 * caller refreshes its own session list with the returned title.
 */
export function useRegenerateTitleMutation() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: (args: { resourceId: string; scope?: string }) =>
      client.post<{ ok: true; title: string; threadId: string }>('/web/config/title-generation/regenerate', args),
  });
}
