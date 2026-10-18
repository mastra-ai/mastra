import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type MCPServerToolsById = Record<string, Awaited<ReturnType<MastraClient['getMcpServerTools']>>['tools'][number]>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useMCPServerToolsById = <TData = MCPServerToolsById>({
  serverId,
  queryOptions,
}: {
  serverId: string | null;
  queryOptions?: MastraQueryOptions<MCPServerToolsById, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcpserver-tools', serverId],
    queryFn: async (): Promise<MCPServerToolsById> => {
      const response = await client.getMcpServerTools(serverId!);
      return Object.fromEntries(response.tools.map(tool => [tool.name, tool]));
    },
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};
