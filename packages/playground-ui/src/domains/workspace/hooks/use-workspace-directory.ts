import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** Lists a single directory level. Callers enable it only once the folder is expanded. */
export function useWorkspaceDirectory(workspaceId: string, path: string, { enabled = true } = {}) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', workspaceId, 'fs', 'list', path],
    queryFn: async () => (await client.getWorkspace(workspaceId).listFiles(path, false)).entries,
    enabled,
  });
}
