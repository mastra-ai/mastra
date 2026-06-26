import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ActivateModelPackResponse, ModelPacksResponse, OkResponse, SaveModelPackBody } from '../api/types';

/**
 * Model packs (mirrors the TUI `/models-pack` command). Listing + custom-pack
 * CRUD are global; activation is session-scoped and needs the active project's
 * `resourceId`. The list is keyed by `resourceId` so switching projects yields a
 * distinct cache entry (active-pack state differs per session). The query stays
 * enabled without a `resourceId` — it just returns packs with no active flag,
 * matching the current component which loads the catalog either way.
 */
export function useModelPacksQuery(resourceId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<ModelPacksResponse>({
    queryKey: queryKeys.modelPacks(resourceId),
    queryFn: () => {
      const qs = resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : '';
      return client.get<ModelPacksResponse>(`/api/web/config/model-packs${qs}`);
    },
  });
}

export interface ActivateModelPackArgs {
  id: string;
}

export function useActivateModelPack(resourceId: string | undefined) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: ActivateModelPackArgs) =>
      client.post<ActivateModelPackResponse>(`/api/web/config/model-packs/${encodeURIComponent(id)}/activate`, {
        resourceId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacks(resourceId) }),
  });
}

export function useSaveModelPack(resourceId: string | undefined) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveModelPackBody) => client.post<{ ok: true }>('/api/web/config/model-packs', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacks(resourceId) }),
  });
}

export interface RemoveModelPackArgs {
  id: string;
}

export function useRemoveModelPack(resourceId: string | undefined) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveModelPackArgs) =>
      client.del<OkResponse>(`/api/web/config/model-packs/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacks(resourceId) }),
  });
}
