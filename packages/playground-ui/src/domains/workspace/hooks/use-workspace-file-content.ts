import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useWorkspaceFileContent(workspaceId: string, path: string | null) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', workspaceId, 'fs', 'read', path],
    queryFn: async () => (await client.getWorkspace(workspaceId).readFile(path ?? '')).content,
    enabled: !!path,
  });
}
