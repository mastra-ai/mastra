import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface McpAppToolInfo {
  serverId: string;
  toolId: string;
  resourceUri: string;
}

/**
 * Builds a map of tool names → MCP App info for all tools across MCP servers
 * that have `_meta.ui.resourceUri` (i.e., tools with interactive MCP App UIs).
 */
export function useMcpAppTools() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-app-tools'],
    queryFn: async () => {
      const map: Record<string, McpAppToolInfo> = {};

      const { servers } = await client.getMcpServers();
      if (!servers?.length) return map;

      const results = await Promise.allSettled(
        servers.map(async server => {
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
            map[tool.id] = { serverId, toolId: tool.id, resourceUri };
            if (tool.name !== tool.id) {
              map[tool.name] = { serverId, toolId: tool.id, resourceUri };
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
