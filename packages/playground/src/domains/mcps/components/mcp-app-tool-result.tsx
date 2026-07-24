import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { McpAppToolInfo } from '../hooks/use-mcp-app-tools';
import { McpAppViewer } from './mcp-app-viewer';

interface McpAppToolResultProps {
  appInfo: McpAppToolInfo;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  onSendMessage?: (content: string) => void;
}

/**
 * Fetches MCP App HTML from the resource URI and renders it in a McpAppViewer.
 * Used inline in agent chat when a tool call has an associated MCP App UI.
 *
 * Passes tool arguments and result to the iframe via the MCP Apps protocol
 * (ui/notifications/tool-input and ui/notifications/tool-result), enabling
 * the app to hydrate with data from the tool call.
 */
export function McpAppToolResult({ appInfo, toolArgs, toolResult, onSendMessage }: McpAppToolResultProps) {
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
      toolName={appInfo.toolName}
      toolInput={toolArgs}
      toolResult={toolResult}
      onToolCall={handleToolCall}
      onSendMessage={onSendMessage}
      className="rounded-md border border-border1"
    />
  );
}
