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

/** The agents a phase may run on, for the phase agent picker. Shares the config request. */
export function useBoardAgentsQuery(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.boardConfig(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardConfigResponse>(path(factoryProjectId!)),
    select: data => data.agents,
  });
}

export function useSaveBoardConfigMutation(factoryProjectId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BoardConfigUpdateBody) =>
      client.put<Pick<BoardConfigResponse, 'config'>>(path(factoryProjectId), body),
    onSuccess: data => {
      // The save answers with the config only; keep the runners and agents the read returned.
      queryClient.setQueryData<BoardConfigResponse>(queryKeys.boardConfig(factoryProjectId), current =>
        current ? { ...current, ...data } : undefined,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId) });
    },
  });
}
