import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ToolsResponse = Awaited<ReturnType<MastraClient['listTools']>>;
type ToolResponse = Awaited<ReturnType<ReturnType<MastraClient['getTool']>['details']>>;

export const useTools = <TData = ToolsResponse>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ToolsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools', requestContext],
    queryFn: () => client.listTools(requestContext),
    ...queryOptions,
  });
};

export const useTool = <TData = ToolResponse>({
  toolId,
  requestContext,
  queryOptions,
}: {
  toolId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ToolResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool', toolId, requestContext],
    queryFn: () => client.getTool(toolId).details(requestContext),
    ...queryOptions,
  });
};
