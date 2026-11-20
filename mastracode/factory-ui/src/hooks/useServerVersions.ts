import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export interface ServerVersions {
  /** Mastra packages the server was built with. Empty when its build shipped no packages manifest. */
  packages: Array<{ name: string; version: string }>;
  nodeVersion: string;
}

export function useServerVersions() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.serverVersions(),
    queryFn: () => client.get<ServerVersions>('/web/config/versions'),
  });
}
