import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardConfigResponse, BoardConfigUpdateBody } from '../api/types';

const path = (factoryProjectId: string) => `/web/factory/projects/${factoryProjectId}/boards/config`;

export function useBoardConfigQuery(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.boardConfig(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardConfigResponse>(path(factoryProjectId!)),
    select: data => data.config,
  });
}

/** The runner ids the server can run, for the phase runner picker. Shares the config request. */
export function useBoardRunnersQuery(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.boardConfig(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardConfigResponse>(path(factoryProjectId!)),
    select: data => data.runners,
  });
}

export function useSaveBoardConfigMutation(factoryProjectId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BoardConfigUpdateBody) => client.put<BoardConfigResponse>(path(factoryProjectId), body),
    onSuccess: data => {
      queryClient.setQueryData(queryKeys.boardConfig(factoryProjectId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId) });
    },
  });
}
