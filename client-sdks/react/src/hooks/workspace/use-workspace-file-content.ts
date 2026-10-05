import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { isMediaFile } from './file-type';
import { WORKSPACE_REFETCH_INTERVAL } from './use-workspace-directory';

/** Reads a file (base64 for images/videos) and polls it so the viewer follows external edits. */
type WorkspaceFileContent = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['readFile']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useWorkspaceFileContent<TData = WorkspaceFileContent>({
  workspaceId,
  path,
  queryOptions,
}: {
  workspaceId: string;
  path?: string;
  queryOptions?: MastraQueryOptions<WorkspaceFileContent, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const encoding = path && isMediaFile(path) ? 'base64' : undefined;

  return useQuery<WorkspaceFileContent, Error, TData>({
    queryKey: ['workspace', workspaceId, 'fs', 'read', path, encoding],
    queryFn: () => client.getWorkspace(workspaceId).readFile(path ?? '', encoding),
    refetchInterval: WORKSPACE_REFETCH_INTERVAL,
    ...queryOptions,
  });
}
