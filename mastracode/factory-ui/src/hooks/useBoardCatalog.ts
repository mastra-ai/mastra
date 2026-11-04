import { queryOptions, useQuery } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardCatalogResponse } from '../api/types';

export function boardCatalogQuery(client: ApiClient, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.boardCatalog(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardCatalogResponse>(`/web/factory/projects/${factoryProjectId}/boards`),
  });
}

export function useBoardCatalog(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({ ...boardCatalogQuery(client, factoryProjectId), select: data => data.boards });
}
