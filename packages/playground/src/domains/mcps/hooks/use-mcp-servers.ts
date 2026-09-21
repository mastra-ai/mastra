import type { McpServerListResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useMCPServers = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const mcpServers: McpServerListResponse['servers'] = (await client.getMcpServers()).servers;
      return mcpServers;
    },
  });
};
