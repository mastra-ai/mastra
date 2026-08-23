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

export function useUpdateTitleGenerationMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateTitleGenerationArgs) =>
      client.put<UpdateTitleGenerationConfigResponse>('/web/config/title-generation', args),
    onSuccess: res => queryClient.setQueryData(queryKeys.titleGeneration(), res.config),
  });
}
