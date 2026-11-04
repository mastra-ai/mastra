import type { ListStoredWorkspacesParams, ListStoredWorkspacesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * Hook to list stored workspaces from the database.
 * These are workspaces that have been persisted via the stored workspaces API,
 * as opposed to runtime-registered workspaces from code-defined agents.
 */
export const useStoredWorkspaces = <TData = ListStoredWorkspacesResponse>({
  queryOptions,
  ...params
}: ListStoredWorkspacesParams & {
  queryOptions?: MastraQueryOptions<ListStoredWorkspacesResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListStoredWorkspacesResponse, Error, TData>({
    queryKey: ['stored-workspaces', params],
    queryFn: async (): Promise<ListStoredWorkspacesResponse> => {
      return client.listStoredWorkspaces(params);
    },
    ...queryOptions,
  });
};
