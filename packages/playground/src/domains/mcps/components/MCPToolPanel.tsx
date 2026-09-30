import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { McpAppViewer } from '@mastra/playground-ui/domains/mcps/components/mcp-app-viewer';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import type { JsonSchema } from '@mastra/schema-compat/json-to-zod';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { z } from 'zod';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useExecuteMCPTool, useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';
import { ToolOverview } from '@/domains/tools/components/tool-overview';
import { ToolView } from '@/domains/tools/components/tool-view';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';

export interface MCPToolPanelProps {
  toolId: string;
  serverId: string;
}

/** Extract the ui:// resource URI from a tool's _meta, supporting both modern and legacy formats */
function getAppResourceUri(meta?: Record<string, unknown>): string | undefined {
  if (!meta) return undefined;
  const ui = meta.ui as { resourceUri?: string } | undefined;
  if (ui?.resourceUri) return ui.resourceUri;
  // Legacy flat key: "ui/resourceUri"
  const legacy = meta['ui/resourceUri'];
  if (typeof legacy === 'string') return legacy;
  return undefined;
}

/**
 * An MCP 2.x tool answers with `{ status: 'suspended' }` when it needs more input before it can finish.
 * Studio has no way to collect that input, so the response is explained rather than shown as the tool's output.
 */
function isSuspendedResult(result: unknown): boolean {
  return typeof result === 'object' && result !== null && (result as { status?: unknown }).status === 'suspended';
}

export const MCPToolPanel = ({ toolId, serverId }: MCPToolPanelProps) => {
  const { canExecute } = usePermissions();
  const canExecuteTool = canExecute('tools');
  const client = useMastraClient();

  const { data: tool, isLoading, error } = useMCPServerTool(serverId, toolId);
  const { mutateAsync: executeTool, data: result } = useExecuteMCPTool(serverId, toolId);

  const appResourceUri = tool ? getAppResourceUri(tool._meta) : undefined;

  // Fetch the app resource HTML when the tool has a ui:// resource
  const { data: appHtml } = useQuery({
    queryKey: ['mcp-app-resource', serverId, appResourceUri],
    queryFn: async () => {
      if (!appResourceUri) return null;
      const response = await client.readMcpServerResource(serverId, appResourceUri);
      const content = response.contents[0];
      return content?.text ?? null;
    },
    enabled: !!appResourceUri,
  });

  const handleToolCall = useCallback(
    async (_toolName: string, args: Record<string, unknown>) => {
      const response = await executeTool({ data: args });
      return response;
    },
    [executeTool],
  );

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tool';
      toast.error(`Error loading tool: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = (data: unknown, requestContext?: Record<string, unknown>) =>
    executeTool({ data, requestContext });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return null;

  if (!tool)
    return (
      <div className="px-4 py-8 text-center">
        <Txt variant="heading" tone="muted">
          Tool not found
        </Txt>
      </div>
    );

  let zodInputSchema;
  try {
    zodInputSchema = jsonSchemaToZodRuntime(tool.inputSchema as unknown as JsonSchema);
  } catch (e) {
    console.error('Error processing input schema:', e);
    toast.error('Failed to process tool input schema.');
    zodInputSchema = z.object({});
  }

  return (
    <ToolView
      header={<ToolInformation toolId={tool.name} toolDescription={tool.description || ''} />}
      overview={<ToolOverview inputSchema={tool.inputSchema} />}
      playground={
        canExecuteTool ? (
          <div className="grid gap-4">
            {appHtml && <McpAppViewer html={appHtml} toolName={tool.name} onToolCall={handleToolCall} />}
            {isSuspendedResult(result) && (
              <Notice variant="warning">
                This tool asked for more input, which Studio cannot provide. The suspend payload below shows what it
                needs. Call it from an MCP client with an <code>inputRequests</code> handler to finish the request.
              </Notice>
            )}
            <ToolExecutor
              zodInputSchema={zodInputSchema}
              handleExecuteTool={handleExecuteTool}
              requestContextEntityType="mcp-tool"
              requestContextEntityId={`${serverId}:${tool.name}`}
            />
          </div>
        ) : undefined
      }
    />
  );
};
