import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const WORKSPACE_REFETCH_INTERVAL = 10_000;

/** Lists a single directory level and polls it. Callers enable it only once the folder is expanded. */
type WorkspaceDirectoryEntries = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['listFiles']>>['entries'];

const directoryQuery = (client: MastraClient, workspaceId: string, path: string) => ({
  queryKey: ['workspace', workspaceId, 'fs', 'list', path],
  queryFn: async () => (await client.getWorkspace(workspaceId).listFiles(path, false)).entries,
  refetchInterval: WORKSPACE_REFETCH_INTERVAL,
});

export function useWorkspaceDirectory<TData = WorkspaceDirectoryEntries>({
  workspaceId,
  path,
  queryOptions,
}: {
  workspaceId: string;
  path: string;
  queryOptions?: MastraQueryOptions<WorkspaceDirectoryEntries, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery<WorkspaceDirectoryEntries, Error, TData>({
    ...directoryQuery(client, workspaceId, path),
    ...queryOptions,
  });
}

export function useWorkspaceDirectories({
  workspaceId,
  paths,
}: {
  workspaceId: string;
  paths: readonly string[];
}): UseQueryResult<WorkspaceDirectoryEntries, Error>[] {
  const client = useMastraClient();

  return useQueries({ queries: paths.map(path => directoryQuery(client, workspaceId, path)) });
}
