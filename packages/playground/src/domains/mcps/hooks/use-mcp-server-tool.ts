import type { RequestContext } from '@mastra/core/request-context';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery } from '@tanstack/react-query';

export const useMCPServerTool = (serverId: string, toolId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-server-tool', serverId, toolId],
    queryFn: () => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.details();
    },
    enabled: options?.enabled !== false && !!serverId && !!toolId,
  });
};

export const useExecuteMCPTool = (serverId: string, toolId: string) => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: ({ data, requestContext }: { data: any; requestContext?: Record<string, unknown> }) => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.execute({ data, requestContext: requestContext as unknown as RequestContext });
    },
  });
};
