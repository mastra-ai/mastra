import { Skeleton, Txt, toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import type { JsonSchema } from '@mastra/schema-compat/json-to-zod';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { z } from 'zod';
import { McpAppViewer } from './mcp-app-viewer';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useExecuteMCPTool, useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';
import { resolveSerializedZodOutput } from '@/lib/form/utils';

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

export const MCPToolPanel = ({ toolId, serverId }: MCPToolPanelProps) => {
  const { canExecute } = usePermissions();
  const canExecuteTool = canExecute('tools');
  const client = useMastraClient();

  const { data: tool, isLoading, error } = useMCPServerTool(serverId, toolId);
  const { mutateAsync: executeTool, isPending: isExecuting, data: result } = useExecuteMCPTool(serverId, toolId);

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
      const response = await executeTool(args);
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

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    return await executeTool(data);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return null;

  if (!tool)
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="header-md" className="text-neutral3">
          Tool not found
        </Txt>
      </div>
    );

  if (!canExecuteTool)
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="ui-sm" className="text-neutral3">
          You don't have permission to execute tools.
        </Txt>
      </div>
    );

  let zodInputSchema;
  try {
    zodInputSchema = resolveSerializedZodOutput(jsonSchemaToZod(tool.inputSchema as unknown as JsonSchema));
  } catch (e) {
    console.error('Error processing input schema:', e);
    toast.error('Failed to process tool input schema.');
    zodInputSchema = z.object({});
  }

  return (
    <div className="flex flex-col gap-4">
      {appHtml && (
        <div className="border-b border-border1 p-4">
          <McpAppViewer html={appHtml} toolName={tool.name ?? tool.id} onToolCall={handleToolCall} />
        </div>
      )}
      <ToolExecutor
        executionResult={result}
        isExecutingTool={isExecuting}
        zodInputSchema={zodInputSchema}
        handleExecuteTool={handleExecuteTool}
        toolDescription={tool.description || ''}
        toolId={tool.id}
      />
    </div>
  );
};
