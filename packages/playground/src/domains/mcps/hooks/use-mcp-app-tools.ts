import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface McpAppToolInfo {
  serverId: string;
  toolId: string;
  toolName: string;
  resourceUri: string;
}

/**
 * Builds a map of tool names → MCP App info for tools across all registered
 * MCP servers that have `_meta.ui.resourceUri` (i.e., tools with interactive
 * MCP App UIs).
 *
 * For each app tool, entries are created under both the original tool name
 * and the namespaced name (`${serverId}_${toolName}`) so that agent tools
 * sourced via `MCPClient.listTools()` (which namespaces) can be resolved.
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
            const toolId = tool.id ?? tool.name;
            const info: McpAppToolInfo = { serverId, toolId, toolName: tool.name, resourceUri };
            map[toolId] = info;
            if (tool.name !== toolId) {
              map[tool.name] = info;
            }
            // Also map the namespaced name used by MCPClient.listTools()
            map[`${serverId}_${tool.name}`] = info;
          }
        }
      }

      return map;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
