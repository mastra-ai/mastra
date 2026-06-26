import type { ListStoredWorkspacesParams, ListStoredWorkspacesResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to list stored workspaces from the database.
 * These are workspaces that have been persisted via the stored workspaces API,
 * as opposed to runtime-registered workspaces from code-defined agents.
 */
export const useStoredWorkspaces = (params?: ListStoredWorkspacesParams, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-workspaces', params],
    queryFn: async (): Promise<ListStoredWorkspacesResponse> => {
      return client.listStoredWorkspaces(params);
    },
    enabled: options?.enabled !== false,
  });
};
