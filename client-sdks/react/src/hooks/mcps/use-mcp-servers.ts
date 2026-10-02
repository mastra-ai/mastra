import type { McpServerListResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@/mastra-client-context';

export const useMCPServers = (requestContext?: Record<string, any>) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const mcpServers: McpServerListResponse['servers'] = (await client.getMcpServers(requestContext)).servers;
      return mcpServers;
    },
  });
};
