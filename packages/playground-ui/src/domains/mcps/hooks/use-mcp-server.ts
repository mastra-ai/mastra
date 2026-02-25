import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useMCPServer = (serverId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['mcp-server', serverId, requestContext],
    queryFn: () => client.getMcpServerDetails(serverId!),
    enabled: Boolean(serverId),
    retry: false,
  });
};
