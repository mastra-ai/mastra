import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ActivateModelPackResponse, ModelPacksResponse, OkResponse, SaveModelPackBody } from '../api/types';

/**
 * Model packs (mirrors the TUI `/models-pack` command). Listing + custom-pack
 * CRUD are global; activation is session-scoped and needs the active factory's
 * `resourceId`. The list is keyed by `resourceId` so switching factories yields a
 * distinct cache entry (active-pack state differs per session). The query stays
 * enabled without a `resourceId` — it just returns packs with no active flag,
 * matching the current component which loads the catalog either way.
 */
export function useModelPacksQuery(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  return useQuery<ModelPacksResponse>({
    queryKey: queryKeys.modelPacks(resourceId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (resourceId) params.set('resourceId', resourceId);
      if (resourceId && scope) params.set('scope', scope);
      const qs = params.size ? `?${params.toString()}` : '';
      return client.get<ModelPacksResponse>(`/web/config/model-packs${qs}`);
    },
  });
}

export interface ActivateModelPackArgs {
  id: string;
}

export function useActivateModelPack(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: ActivateModelPackArgs) =>
      client.post<ActivateModelPackResponse>(`/web/config/model-packs/${encodeURIComponent(id)}/activate`, {
        resourceId,
        scope,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacks(resourceId) }),
  });
}

export function useSaveModelPack() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveModelPackBody) => client.post<{ ok: true }>('/web/config/model-packs', body),
    // Custom-pack CRUD is global: invalidate every cached model-packs entry, not just this resource's.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacksAll() }),
  });
}

export interface RemoveModelPackArgs {
  id: string;
}

export function useRemoveModelPack() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveModelPackArgs) =>
      client.del<OkResponse>(`/web/config/model-packs/${encodeURIComponent(id)}`),
    // Custom-pack CRUD is global: invalidate every cached model-packs entry, not just this resource's.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacksAll() }),
  });
}
