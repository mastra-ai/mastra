import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { OMResponse, UpdateOMResponse } from '../api/types';

/**
 * Observational Memory config (mirrors the TUI `/om` command). Everything is
 * session-scoped: the GET route requires the active factory's `resourceId`, so
 * the query is gated by `enabled` and stays idle until a project is open. The
 * cache is keyed by `resourceId` so switching projects yields a distinct entry.
 *
 * The update mutations return the full refreshed `{ config }`, so they write it
 * straight into the cache via `setQueryData` instead of triggering a refetch —
 * preserving the single-response UX the section relies on.
 */
export function useOMQuery(resourceId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<OMResponse>({
    queryKey: queryKeys.om(resourceId),
    queryFn: () => client.get<OMResponse>(`/web/config/om?resourceId=${encodeURIComponent(resourceId as string)}`),
    enabled: !!resourceId,
  });
}

type OMRole = 'observer' | 'reflector';

export interface UpdateOMModelArgs {
  modelId: string;
}

export function useUpdateOMModel(resourceId: string | undefined, role: OMRole) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId }: UpdateOMModelArgs) =>
      client.put<UpdateOMResponse>(`/web/config/om/${role}/model`, { resourceId, modelId }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}

export interface UpdateOMThresholdsArgs {
  observationThreshold?: number;
  reflectionThreshold?: number;
}

export function useUpdateOMThresholds(resourceId: string | undefined) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateOMThresholdsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/thresholds', { resourceId, ...args }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}

export interface UpdateOMObserveAttachmentsArgs {
  value: 'auto' | boolean;
}

export function useUpdateOMObserveAttachments(resourceId: string | undefined) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value }: UpdateOMObserveAttachmentsArgs) =>
      client.put<UpdateOMResponse>('/web/config/om/observe-attachments', { resourceId, value }),
    onSuccess: res => queryClient.setQueryData<OMResponse>(queryKeys.om(resourceId), { config: res.config }),
  });
}
