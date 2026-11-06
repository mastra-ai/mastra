import { useQuery } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export interface ServerStatusProblem {
  code: string;
  title: string;
  message: string;
  /** The one step that fixes it. Env var names are wrapped in backticks. */
  fix?: string;
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
    queryFn: () =>
      client.get<ServerStatus>('/web/status').catch((error: unknown): ServerStatus => {
        // Servers that predate the endpoint have nothing to report.
        if (error instanceof ApiError && error.status === 404) return { problems: [] };
        throw error;
      }),
    // A blip on the one read must not hide a real problem until the next reload.
    retry: 3,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
