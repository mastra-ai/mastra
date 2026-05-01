import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface McpAppToolInfo {
  serverId: string;
  toolId: string;
  resourceUri: string;
}

/**
 * Builds a map of tool names → MCP App info for tools across MCP servers
 * that have `_meta.ui.resourceUri` (i.e., tools with interactive MCP App UIs).
 *
 * When `mcpServerIds` is provided, only those servers are scanned.
 * This allows scoping app resource lookups to an agent's declared MCP servers.
 */
export function useMcpAppTools(mcpServerIds?: string[]) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-app-tools', mcpServerIds ?? 'all'],
    queryFn: async () => {
      const map: Record<string, McpAppToolInfo> = {};

      const { servers } = await client.getMcpServers();
      if (!servers?.length) return map;

      const filteredServers = mcpServerIds ? servers.filter(s => mcpServerIds.includes(s.id)) : servers;

      const results = await Promise.allSettled(
        filteredServers.map(async server => {
          const { tools } = await client.getMcpServerTools(server.id);
          return { serverId: server.id, tools };
        }),
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { serverId, tools } = result.value;
        for (const tool of tools) {
          const meta = tool._meta as { ui?: { resourceUri?: string } } | undefined;
          const resourceUri = meta?.ui?.resourceUri;
          if (resourceUri) {
            const toolId = tool.id ?? tool.name;
            map[toolId] = { serverId, toolId, resourceUri };
            if (tool.name !== toolId) {
              map[tool.name] = { serverId, toolId, resourceUri };
            }
          }
        }
      }

      return map;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
