import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { listMcpServerTools, toMcpAppToolMap } from './mcp-app-tools';
import type { McpAppToolInfo } from './mcp-app-tools';

export type { McpAppToolInfo } from './mcp-app-tools';

/**
 * Builds a map of tool names → MCP App info for tools across all registered
 * MCP servers that have `_meta.ui.resourceUri` (i.e., tools with interactive
 * MCP App UIs).
 *
 * For each app tool, entries are created under both the original tool name
 * and the namespaced name (`${serverId}_${toolName}`) so that agent tools
 * sourced via `MCPClient.listTools()` (which namespaces) can be resolved.
 */
export function useMcpAppTools<TData = Record<string, McpAppToolInfo>>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<Record<string, McpAppToolInfo>, TData> } = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-app-tools'],
    queryFn: async () => toMcpAppToolMap(await listMcpServerTools(client)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
}
