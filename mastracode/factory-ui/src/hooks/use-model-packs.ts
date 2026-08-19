import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import type {
  ActivateModelPackBody,
  ActivateModelPackResponse,
  ClearDefaultModelPackResponse,
  ModelPacksResponse,
  OkResponse,
  SaveModelPackBody,
} from '../api/types';

/**
 * Model-pack definitions are organization-scoped. The active pack is the
 * user's default for new interactive chats; a resourceId reads the pack
 * selected specifically for that thread.
 */
export function useModelPacksQuery(resourceId?: string, scope?: string) {
  const { client } = useApiConfig();
  return useQuery<ModelPacksResponse>({
    queryKey: queryKeys.modelPacks(resourceId, scope),
    queryFn: () => {
      const params = new URLSearchParams();
      if (resourceId) params.set('resourceId', resourceId);
      if (resourceId && scope) params.set('scope', scope);
      const query = params.size ? `?${params.toString()}` : '';
      return client.get<ModelPacksResponse>(`/web/config/model-packs${query}`);
    },
  });
}

export interface ActivateModelPackArgs {
  id: string;
  target: ActivateModelPackBody['target'];
}

export function useActivateModelPack(resourceId: string | undefined, scope?: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, target }: ActivateModelPackArgs) =>
      client.post<ActivateModelPackResponse>(`/web/config/model-packs/${encodeURIComponent(id)}/activate`, {
        target,
        ...(target === 'session' ? { resourceId, scope } : {}),
      } satisfies ActivateModelPackBody),
    onSuccess: async (_, { target }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.modelPacksAll() });
      if (target === 'session' && resourceId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, resourceId, scope),
        });
      }
    },
  });
}

export function useClearDefaultModelPack() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.del<ClearDefaultModelPackResponse>('/web/config/model-packs/active'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.modelPacksAll() }),
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
