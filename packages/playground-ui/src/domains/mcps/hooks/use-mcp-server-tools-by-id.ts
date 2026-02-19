import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useMCPServerToolsById = (serverId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcpserver-tools', serverId],
    queryFn: async () => {
      const response = await client.getMcpServerTools(serverId!);
      return Object.fromEntries(response.tools.map(tool => [tool.id, tool]));
    },
    enabled: Boolean(serverId),
    retry: false,
    refetchOnWindowFocus: false,
  });
};
