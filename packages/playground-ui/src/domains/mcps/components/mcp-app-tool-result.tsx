import { useMastraClient } from '@mastra/react';
import type { McpAppToolInfo } from '@mastra/react/hooks/mcps';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useMcpAppHostContext } from '../context/mcp-app-host-context-value';
import type { McpAppModelContextParams, McpAppRef } from '../context/mcp-app-host-context-value';
import { useMcpAppToolCall } from '../hooks/use-mcp-app-tool-call';
import { McpAppViewer } from './mcp-app-viewer';
import { Txt } from '@/ds/components/Txt';

interface McpAppToolResultProps {
  appInfo: McpAppToolInfo;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  /** The chat tool call that rendered this app. Required for an `McpAppHostProvider` to reach the app. */
  toolCallId?: string;
  onSendMessage?: (content: string) => void;
  onUpdateModelContext?: (context: string | undefined) => void;
  readOnly?: boolean;
}

/**
 * Fetches MCP App HTML from the resource URI and renders it in a McpAppViewer.
 * Used inline in agent chat when a tool call has an associated MCP App UI.
 *
 * Passes tool arguments and result to the iframe via the MCP Apps protocol
 * (ui/notifications/tool-input and ui/notifications/tool-result), enabling
 * the app to hydrate with data from the tool call.
 */
export function McpAppToolResult({
  appInfo,
  toolArgs,
  toolResult,
  toolCallId,
  onSendMessage,
  onUpdateModelContext,
  readOnly,
}: McpAppToolResultProps) {
  const client = useMastraClient();
  const host = useMcpAppHostContext();
  const { toolName, resourceUri } = appInfo;
  const app: McpAppRef | undefined = useMemo(
    () => (toolCallId === undefined ? undefined : { toolName, toolCallId, resourceUri }),
    [toolName, toolCallId, resourceUri],
  );
  const hostContext = useMemo(() => (app && host?.hostContext?.(app)) || undefined, [app, host]);
  const onModelContext = useMemo(() => {
    const handler = host?.onModelContext;
    if (!app || !handler || readOnly) return undefined;
    return (params: McpAppModelContextParams) => handler(app, params);
  }, [app, host, readOnly]);

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

  const handleToolCall = useMcpAppToolCall(appInfo.serverId);

  if (isLoading || !html) {
    return (
      <Txt as="p" variant="body" tone="muted" className="rounded-md border border-border bg-background p-4">
        Loading MCP App UI…
      </Txt>
    );
  }

  return (
    <McpAppViewer
      html={html}
      toolName={appInfo.toolName}
      toolInput={toolArgs}
      toolResult={toolResult}
      onToolCall={readOnly ? undefined : handleToolCall}
      onSendMessage={readOnly ? undefined : onSendMessage}
      onUpdateModelContext={readOnly ? undefined : onUpdateModelContext}
      onModelContext={onModelContext}
      hostContext={hostContext}
      className="rounded-md border border-border"
    />
  );
}
