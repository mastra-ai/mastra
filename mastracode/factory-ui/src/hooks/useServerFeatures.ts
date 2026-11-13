import { queryOptions, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import type { ApiClient } from '../api/client';
import { queryKeys } from '../api/keys';

export interface ServerFeatures {
  knowledge: boolean;
  /** The server serves its MCP endpoint. Absent from servers that predate it. */
  mcp?: boolean;
}

export function serverFeaturesQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.serverFeatures(),
    queryFn: () => client.get<ServerFeatures>('/web/config/features'),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useServerFeatures() {
  const { client } = useApiConfig();
  return useQuery(serverFeaturesQueryOptions(client));
}
