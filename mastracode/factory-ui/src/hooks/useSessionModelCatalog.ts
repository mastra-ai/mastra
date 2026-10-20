import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { AvailableModelsFilter } from '../api/keys';
import type { AvailableModelOption } from './useAvailableModels';

export interface SessionModelCatalogTarget extends AvailableModelsFilter {
  resourceId: string;
  threadId: string;
  enabled?: boolean;
}

export interface SessionModelCatalog {
  models: AvailableModelOption[];
  modelScope?: 'factory' | 'user';
  defaultModelId?: string | null;
}

export function fetchSessionModelCatalog(client: ApiClient, target: SessionModelCatalogTarget) {
  const query = new URLSearchParams({ resourceId: target.resourceId, threadId: target.threadId });
  return client.get<SessionModelCatalog>(`/web/config/models?${query}`);
}

export function sessionModelCatalogQueryOptions(client: ApiClient, target?: SessionModelCatalogTarget) {
  return queryOptions({
    queryKey: queryKeys.availableModels({
      factoryProjectId: target?.factoryProjectId,
      resourceId: target?.resourceId,
      threadId: target?.threadId,
    }),
    queryFn: target ? () => fetchSessionModelCatalog(client, target) : skipToken,
    enabled: target !== undefined && target.enabled !== false,
  });
}

export function useSessionModelCatalogQuery(target?: SessionModelCatalogTarget) {
  const { client } = useApiConfig();
  return useQuery(sessionModelCatalogQueryOptions(client, target));
}
