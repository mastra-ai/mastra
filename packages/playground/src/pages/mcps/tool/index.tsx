import { jsonSchemaToZod, JsonSchema } from 'json-schema-to-zod';
import { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router';
import { z } from 'zod';
import { toast } from 'sonner';

import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Header, Breadcrumb, Crumb, usePlaygroundStore } from '@mastra/playground-ui';

import { useMCPServerTool } from '@/hooks/use-mcp-server-tool';
import ToolExecutor from '@/pages/tools/tool-executor';
import { RuntimeContext } from '@mastra/core/runtime-context';

const MCPServerToolExecutor = () => {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const location = useLocation();

  const passedState = location.state as { serverName?: string; toolData?: { name?: string } } | undefined;
  const toolDisplayNameFromState = passedState?.toolData?.name || toolId;
  const currentServerName = passedState?.serverName || serverId;

  const { tool: mcpTool, isLoading, error } = useMCPServerTool(serverId, toolId);
  const { runtimeContext: playgroundRuntimeContext } = usePlaygroundStore();
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecuteTool = async (data: any) => {
    if (!mcpTool || !mcpTool.instance) {
      toast.error('Tool is not properly initialized');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await mcpTool.instance.execute({
        data,
        runtimeContext: playgroundRuntimeContext as RuntimeContext,
      });
      setExecutionResult(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Tool execution failed';
      console.error('MCP Tool execution error:', e);
      toast.error(errorMessage);
      setExecutionResult({ error: errorMessage });
    } finally {
      setIsExecuting(false);
    }
  };

  const toolActualName = mcpTool?.details?.name || toolDisplayNameFromState;
  const toolActualDescription = mcpTool?.details?.description;
  const toolActualType = mcpTool?.details?.toolType;

  if (isLoading || (!mcpTool && !error)) {
    return (
      <div className="h-full w-full bg-mastra-bg-1">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/mcps`}>
              MCP Servers
            </Crumb>
            {serverId && (
              <Crumb as={Link} to={`/mcps`}>
                {currentServerName}
              </Crumb>
            )}
            <Crumb as="span" to="" isCurrent>
              {isLoading ? 'Loading Tool...' : toolDisplayNameFromState || 'Tool'}
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="w-full h-full grid grid-cols-[300px_1fr] p-2 gap-2">
          <div className="flex flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
            <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
              Input
            </Text>
            <Skeleton className="h-[200px] w-full" />
          </div>
          <div className="flex flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
            <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
              Output
            </Text>
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !mcpTool) {
    return (
      <div className="h-full w-full bg-mastra-bg-1 p-4">
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/mcps`}>
              MCP Servers
            </Crumb>
            {serverId && (
              <Crumb as={Link} to={`/mcps`}>
                {currentServerName}
              </Crumb>
            )}
            <Crumb as="span" to="" isCurrent>
              {toolDisplayNameFromState || 'Error'}
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="text-red-500 mt-4">Error loading tool: {error?.message || 'Tool not found.'}</div>
      </div>
    );
  }

  let zodInputSchema;
  try {
    zodInputSchema = resolveSerializedZodOutput(jsonSchemaToZod(mcpTool.details.inputSchema as JsonSchema));
  } catch (e) {
    console.error('Error processing input schema:', e);
    toast.error('Failed to process tool input schema.');
    zodInputSchema = z.object({});
  }

  return (
    <div className="h-full w-full bg-mastra-bg-1 overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            MCP Servers
          </Crumb>
          <Crumb as={Link} to={`/mcps/${serverId}`}>
            {currentServerName}
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            {toolActualName}
          </Crumb>
        </Breadcrumb>
      </Header>

      <ToolExecutor
        executionResult={executionResult}
        isExecutingTool={isExecuting}
        zodInputSchema={zodInputSchema}
        handleExecuteTool={handleExecuteTool}
        toolDescription={toolActualName || ''}
        toolId={toolId || ''}
        toolType={toolActualType}
      />
    </div>
  );
};

export default MCPServerToolExecutor;
