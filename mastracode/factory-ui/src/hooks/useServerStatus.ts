import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export interface ServerStatusProblem {
  code: string;
  title: string;
  message: string;
  docsUrl?: string;
}

export interface ServerStatus {
  problems: ServerStatusProblem[];
}

/**
 * Startup problems that stop the whole Factory from working. They only clear
 * with a redeploy, so this is read once per page load.
 */
export function useServerStatus() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.serverStatus(),
    // Servers that predate the endpoint, or a failed check, have nothing to report.
    queryFn: () => client.get<ServerStatus>('/web/status').catch((): ServerStatus => ({ problems: [] })),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
