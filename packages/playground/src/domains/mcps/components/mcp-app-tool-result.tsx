import { McpAppViewer } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { McpAppToolInfo } from '../hooks/use-mcp-app-tools';

interface McpAppToolResultProps {
  appInfo: McpAppToolInfo;
}

/**
 * Fetches MCP App HTML from the resource URI and renders it in a McpAppViewer.
 * Used inline in agent chat when a tool call has an associated MCP App UI.
 */
export function McpAppToolResult({ appInfo }: McpAppToolResultProps) {
  const client = useMastraClient();

  const { data: html, isLoading } = useQuery({
    queryKey: ['mcp-app-html', appInfo.serverId, appInfo.resourceUri],
    queryFn: async () => {
      const response = await client.readMcpServerResource(appInfo.serverId, appInfo.resourceUri);
      const content = response.contents?.[0];
      return content?.text ?? '';
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const handleToolCall = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      const tool = client.getMcpServerTool(appInfo.serverId, toolName);
      return tool.execute({ data: args });
    },
    [client, appInfo.serverId],
  );

  if (isLoading || !html) {
    return (
      <div className="rounded-md border border-border1 bg-surface2 p-4 text-text2 text-sm">Loading MCP App UI…</div>
    );
  }

  return (
    <McpAppViewer
      html={html}
      title="MCP App"
      onToolCall={handleToolCall}
      className="rounded-md border border-border1"
    />
  );
}
