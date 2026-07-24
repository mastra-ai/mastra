import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { OMResponse, ProviderOMDefaultsResponse, UpdateOMResponse } from '../api/types';

/**
 * Observational Memory config (mirrors the TUI `/om` command). Settings are
 * persisted per user and can be managed without an active chat session. When a
 * session is available, resourceId and scope let the server apply changes to it
 * immediately as well.
 *
 * The update mutations return the full refreshed `{ config }`, so they write it
 * straight into the cache via `setQueryData` instead of triggering a refetch —
 * preserving the single-response UX the section relies on.
 */
export function useOMQuery(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  return useQuery<OMResponse>({
    queryKey: queryKeys.om(resourceId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (resourceId) params.set('resourceId', resourceId);
      if (scope) params.set('scope', scope);
      const query = params.size > 0 ? `?${params.toString()}` : '';
      return client.get<OMResponse>(`/web/config/om${query}`);
    },
  });
}

export function useApplyProviderOMDefaults() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, factoryModelId }: { providerId: string; factoryModelId: string }) =>
      client.post<ProviderOMDefaultsResponse>('/web/config/om/provider-defaults', {
        providerId,
        factoryModelId,
      }),
    onSuccess: response => queryClient.setQueryData<OMResponse>(queryKeys.om(undefined), { config: response.config }),
  });
}

type OMRole = 'observer' | 'reflector';

export interface UpdateOMModelArgs {
  modelId: string;
}

export function useUpdateOMModel(resourceId: string | undefined, role: OMRole, scope?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId }: UpdateOMModelArgs) =>
      client.put<UpdateOMResponse>(`/web/config/om/${role}/model`, { resourceId, modelId, scope }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}

export interface UpdateOMThresholdsArgs {
  observationThreshold?: number;
  reflectionThreshold?: number;
}

export function useUpdateOMThresholds(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateOMThresholdsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/thresholds', { resourceId, scope, ...args }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}

export interface UpdateOMObserveAttachmentsArgs {
  value: 'auto' | boolean;
}

export function useUpdateOMObserveAttachments(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value }: UpdateOMObserveAttachmentsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/observe-attachments', { resourceId, value, scope }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}
