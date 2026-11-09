import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardCatalogResponse } from '../api/types';
import { withLegacyFlow } from '../ui/domains/factory/boardFlow';

export function boardCatalogQueryOptions(client: ApiClient, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.boardCatalog(factoryProjectId),
    queryFn: factoryProjectId
      ? () => client.get<BoardCatalogResponse>(`/web/factory/projects/${encodeURIComponent(factoryProjectId)}/boards`)
      : skipToken,
  });
}

export function useBoardCatalog(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    ...boardCatalogQueryOptions(client, factoryProjectId),
    select: data => data.boards.map(withLegacyFlow),
  });
}
