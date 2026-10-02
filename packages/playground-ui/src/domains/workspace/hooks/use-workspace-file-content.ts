import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { isMediaFile } from '../file-type';
import { WORKSPACE_REFETCH_INTERVAL } from './use-workspace-directory';

/** Reads a file (base64 for images/videos) and polls it so the viewer follows external edits. */
export function useWorkspaceFileContent(workspaceId: string, path?: string) {
  const client = useMastraClient();
  const encoding = path && isMediaFile(path) ? 'base64' : undefined;

  return useQuery({
    queryKey: ['workspace', workspaceId, 'fs', 'read', path, encoding],
    queryFn: () => client.getWorkspace(workspaceId).readFile(path ?? '', encoding),
    enabled: !!path,
    refetchInterval: WORKSPACE_REFETCH_INTERVAL,
  });
}
