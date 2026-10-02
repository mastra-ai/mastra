import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardCatalogResponse } from '../api/types';

export function useBoardCatalog(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.boardCatalog(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardCatalogResponse>(`/web/factory/projects/${factoryProjectId}/boards`),
    select: data => data.boards,
  });
}
