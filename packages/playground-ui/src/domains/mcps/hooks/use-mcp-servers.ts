import { McpServerListResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useMCPServers = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const mcpServers: McpServerListResponse['servers'] = (await client.getMcpServers(requestContext)).servers;
      return mcpServers;
    },
  });
};
