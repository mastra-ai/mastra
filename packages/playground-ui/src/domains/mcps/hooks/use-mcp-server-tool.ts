import { usePlaygroundStore } from '@/store/playground-store';
import { RequestContext } from '@mastra/core/request-context';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useMCPServerTool = (serverId: string, toolId: string) => {
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-server-tool', serverId, toolId],
    queryFn: () => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.details(requestContext);
    },
  });
};

export const useExecuteMCPTool = (serverId: string, toolId: string) => {
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();

  return useMutation({
    mutationFn: (data: any) => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.execute({ data, requestContext: requestContext as RequestContext });
    },
  });
};
