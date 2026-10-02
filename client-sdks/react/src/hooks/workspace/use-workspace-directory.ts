import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@/mastra-client-context';

export const WORKSPACE_REFETCH_INTERVAL = 10_000;

/** Lists a single directory level and polls it. Callers enable it only once the folder is expanded. */
export function useWorkspaceDirectory(workspaceId: string, path: string, { enabled = true } = {}) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', workspaceId, 'fs', 'list', path],
    queryFn: async () => (await client.getWorkspace(workspaceId).listFiles(path, false)).entries,
    enabled,
    refetchInterval: WORKSPACE_REFETCH_INTERVAL,
  });
}
