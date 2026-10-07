import type { MastraClient } from '@mastra/client-js';
import type { RequestContext } from '@mastra/core/request-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

type MCPServerToolDetails = Awaited<ReturnType<ReturnType<MastraClient['getMcpServerTool']>['details']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useMCPServerTool = <TData = MCPServerToolDetails>({
  serverId,
  toolId,
  requestContext,
  queryOptions,
}: {
  serverId: string;
  toolId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<MCPServerToolDetails, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-server-tool', serverId, toolId],
    queryFn: () => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.details(requestContext);
    },
    ...queryOptions,
  });
};

export type ExecuteMCPToolResponse = Awaited<ReturnType<ReturnType<MastraClient['getMcpServerTool']>['execute']>>;
type ExecuteMCPToolVariables = { data: any; requestContext?: Record<string, any> };

export const useExecuteMCPTool = ({
  serverId,
  toolId,
  queryOptions,
}: {
  serverId: string;
  toolId: string;
  queryOptions?: MastraMutationOptions<ExecuteMCPToolResponse, ExecuteMCPToolVariables>;
}): UseMutationResult<ExecuteMCPToolResponse, Error, ExecuteMCPToolVariables> => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: ({ data, requestContext }: ExecuteMCPToolVariables) => {
      const instance = client.getMcpServerTool(serverId, toolId);
      return instance.execute({ data, requestContext: requestContext as RequestContext });
    },
    ...queryOptions,
  });
};
