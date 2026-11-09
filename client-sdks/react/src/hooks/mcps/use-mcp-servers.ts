import type { McpServerListResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const useMCPServers = <TData = McpServerListResponse['servers']>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<McpServerListResponse['servers'], TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const mcpServers: McpServerListResponse['servers'] = (await client.getMcpServers(requestContext)).servers;
      return mcpServers;
    },
    ...queryOptions,
  });
};
