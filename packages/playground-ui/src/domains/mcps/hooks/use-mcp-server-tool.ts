import { usePlaygroundStore } from '@/store/playground-store';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useMCPServerTool = (serverId: string, toolId: string) => {
  const { runtimeContext } = usePlaygroundStore();
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-server-tool', serverId, toolId],
    queryFn: () => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.details(runtimeContext);
    },
  });
};

export const useExecuteMCPTool = (serverId: string, toolId: string) => {
  const { runtimeContext } = usePlaygroundStore();
  const client = useMastraClient();

  return useMutation({
    mutationFn: (data: any) => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.execute({ data, runtimeContext: runtimeContext as RuntimeContext });
    },
  });
};
