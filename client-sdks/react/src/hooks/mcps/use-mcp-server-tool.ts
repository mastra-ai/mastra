import type { MastraClient } from '@mastra/client-js';
import type { RequestContext } from '@mastra/core/request-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useMCPServerTool = (
  serverId: string,
  toolId: string,
  options?: { enabled?: boolean },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-server-tool', serverId, toolId],
    queryFn: () => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.details(requestContext);
    },
    enabled: options?.enabled !== false && !!serverId && !!toolId,
  });
};

type ExecuteMCPToolResponse = Awaited<ReturnType<ReturnType<MastraClient['getMcpServerTool']>['execute']>>;
type ExecuteMCPToolVariables = { data: any; requestContext?: Record<string, any> };

export const useExecuteMCPTool = (
  serverId: string,
  toolId: string,
): UseMutationResult<ExecuteMCPToolResponse, Error, ExecuteMCPToolVariables> => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: ({ data, requestContext }: ExecuteMCPToolVariables) => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.execute({ data, requestContext: requestContext as RequestContext });
    },
  });
};
