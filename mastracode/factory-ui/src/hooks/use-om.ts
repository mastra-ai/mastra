import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { OMResponse, ProviderOMDefaultsResponse, UpdateOMResponse } from '../api/types';

/**
 * Observational Memory config (mirrors the TUI `/om` command). Settings are
 * persisted per user and can be managed without an active chat session. When a
 * session is available, resourceId and scope let the server apply changes to it
 * immediately as well. When `factoryId` is set, the hooks address the factory
 * project's shared settings row (used by board runs and channel sessions)
 * instead of the caller's personal row.
 *
 * The update mutations return the full refreshed `{ config }`, so they write it
 * straight into the cache via `setQueryData` instead of triggering a refetch —
 * preserving the single-response UX the section relies on.
 */
export function useOMQuery(resourceId: string | undefined, scope?: string, factoryId?: string) {
  const { client } = useApiConfig();
  return useQuery<OMResponse>({
    queryKey: queryKeys.om(resourceId, factoryId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (resourceId) params.set('resourceId', resourceId);
      if (scope) params.set('scope', scope);
      if (factoryId) params.set('factoryId', factoryId);
      const query = params.size > 0 ? `?${params.toString()}` : '';
      return client.get<OMResponse>(`/web/config/om${query}`);
    },
  });
}

export function useApplyProviderOMDefaults() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      providerId,
      factoryModelId,
      factoryId,
    }: {
      providerId: string;
      factoryModelId: string;
      factoryId?: string;
    }) =>
      client.post<ProviderOMDefaultsResponse>('/web/config/om/provider-defaults', {
        providerId,
        factoryModelId,
        ...(factoryId ? { factoryId } : {}),
      }),
    onSuccess: (response, { factoryId }) =>
      queryClient.setQueryData<OMResponse>(queryKeys.om(undefined, factoryId), { config: response.config }),
  });
}

type OMRole = 'observer' | 'reflector';

export interface UpdateOMModelArgs {
  modelId: string;
}

export function useUpdateOMModel(resourceId: string | undefined, role: OMRole, scope?: string, factoryId?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId }: UpdateOMModelArgs) =>
      client.put<UpdateOMResponse>(`/web/config/om/${role}/model`, { resourceId, modelId, scope, factoryId }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId, factoryId), { config: res.config }),
  });
}

export interface UpdateOMThresholdsArgs {
  observationThreshold?: number;
  reflectionThreshold?: number;
}

export function useUpdateOMThresholds(resourceId: string | undefined, scope?: string, factoryId?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateOMThresholdsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/thresholds', { resourceId, scope, factoryId, ...args }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId, factoryId), { config: res.config }),
  });
}

export interface UpdateOMObserveAttachmentsArgs {
  value: 'auto' | boolean;
}

export function useUpdateOMObserveAttachments(resourceId: string | undefined, scope?: string, factoryId?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value }: UpdateOMObserveAttachmentsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/observe-attachments', { resourceId, value, scope, factoryId }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId, factoryId), { config: res.config }),
  });
}
