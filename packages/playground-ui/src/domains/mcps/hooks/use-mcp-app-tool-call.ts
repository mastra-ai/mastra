import type { McpServerToolListResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

type McpServerTool = McpServerToolListResponse['tools'][number];

/** Per the MCP Apps spec, a tool without `_meta.ui.visibility` is visible to both the model and apps. */
function isAppCallable(tool: McpServerTool): boolean {
  const visibility = (tool._meta as { ui?: { visibility?: unknown } } | undefined)?.ui?.visibility;
  return !Array.isArray(visibility) || visibility.includes('app');
}

/**
 * Runs the tools an MCP App calls on its own server. Tools the server keeps for the model
 * (`_meta.ui.visibility` without `"app"`) are refused, as the MCP Apps spec requires of hosts.
 */
export function useMcpAppToolCall(serverId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      const { tools } = await queryClient.fetchQuery({
        queryKey: ['mcp-app-server-tools', serverId],
        queryFn: () => client.getMcpServerTools(serverId),
        staleTime: 60_000,
      });
      const tool = tools.find(candidate => candidate.name === toolName);
      if (!tool || !isAppCallable(tool)) {
        // Invalid params is the code MCP servers answer an unknown tool with, so apps can tell it apart.
        throw new McpError(
          ErrorCode.InvalidParams,
          `Tool "${toolName}" isn't available to apps on MCP server "${serverId}"`,
        );
      }
      const response = await client.getMcpServerTool(serverId, toolName).execute({ data: args });
      return 'result' in response ? response.result : response;
    },
    [client, queryClient, serverId],
  );
}
