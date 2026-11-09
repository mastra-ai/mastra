import type { MastraClient, McpServerToolListResponse } from '@mastra/client-js';

export interface McpAppToolInfo {
  serverId: string;
  toolId: string;
  toolName: string;
  resourceUri: string;
}

export type McpServerTool = McpServerToolListResponse['tools'][number];

export interface McpServerTools {
  serverId: string;
  tools: McpServerTool[];
}

/** The tools of every registered MCP server. Servers whose tools can't be listed are skipped. */
export async function listMcpServerTools(client: MastraClient): Promise<McpServerTools[]> {
  const { servers } = await client.getMcpServers();
  if (!servers?.length) return [];
  const results = await Promise.allSettled(
    servers.map(async server => ({ serverId: server.id, tools: (await client.getMcpServerTools(server.id)).tools })),
  );
  return results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
}

/**
 * Maps tool names → MCP App info for the tools that have an app (`_meta.ui.resourceUri`). Each app
 * tool is listed under its own name and under `${serverId}_${toolName}`, the name agents see for
 * tools sourced via `MCPClient.listTools()`.
 */
export function toMcpAppToolMap(servers: McpServerTools[]): Record<string, McpAppToolInfo> {
  const map: Record<string, McpAppToolInfo> = {};
  for (const { serverId, tools } of servers) {
    for (const tool of tools) {
      const resourceUri = (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
      if (!resourceUri) continue;
      const info: McpAppToolInfo = { serverId, toolId: tool.name, toolName: tool.name, resourceUri };
      map[tool.name] = info;
      map[`${serverId}_${tool.name}`] = info;
    }
  }
  return map;
}

/** Per the MCP Apps spec, a tool without `_meta.ui.visibility` is visible to both the model and apps. */
export function isAppCallable(tool: McpServerTool): boolean {
  const visibility = (tool._meta as { ui?: { visibility?: unknown } } | undefined)?.ui?.visibility;
  return !Array.isArray(visibility) || visibility.includes('app');
}
