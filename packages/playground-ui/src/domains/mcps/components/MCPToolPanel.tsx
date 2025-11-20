import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import jsonSchemaToZod, { JsonSchema } from 'json-schema-to-zod';
import { z } from 'zod';
import { Txt } from '@/ds/components/Txt';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';
import { useExecuteMCPTool, useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';
import { toast } from '@/lib/toast';
import { useEffect } from 'react';

export interface MCPToolPanelProps {
  toolId: string;
  serverId: string;
}

export const MCPToolPanel = ({ toolId, serverId }: MCPToolPanelProps) => {
  const { data: tool, isLoading, error } = useMCPServerTool(serverId, toolId);
  const { mutateAsync: executeTool, isPending: isExecuting, data: result } = useExecuteMCPTool(serverId, toolId);

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

  if (isLoading || error) return null;

  if (!tool)
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="header-md" className="text-icon3">
          Tool not found
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
    <ToolExecutor
      executionResult={result}
      isExecutingTool={isExecuting}
      zodInputSchema={zodInputSchema}
      handleExecuteTool={handleExecuteTool}
      toolDescription={tool.description || ''}
      toolId={tool.id}
    />
  );
};
