import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useAgent, useExecuteAgentTool } from '@mastra/react/hooks';
import { useEffect } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';

export interface AgentToolPanelProps {
  toolId: string;
  agentId: string;
}

export const AgentToolPanel = ({ toolId, agentId }: AgentToolPanelProps) => {
  const { canExecute } = usePermissions();
  const canExecuteTool = canExecute('tools');

  const {
    data: agent,
    isLoading: isAgentLoading,
    error,
  } = useAgent(agentId!, useEntityRequestContext('agent', agentId)[0]);

  const tool = Object.values(agent?.tools ?? {}).find(tool => tool.id === toolId);

  const { mutateAsync: executeTool, isPending: isExecutingTool, data: result } = useExecuteAgentTool();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agent';
      toast.error(`Error loading agent: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = async (data: any, requestContext?: Record<string, any>) => {
    if (!tool) return;

    try {
      await executeTool({
        agentId: agentId!,
        toolId: tool.id,
        input: data,
        playgroundRequestContext: requestContext,
      });
    } catch (error) {
      toast.error('Error executing agent tool');
      throw error;
    }
  };

  const zodInputSchema = tool?.inputSchema ? jsonSchemaToZodRuntime(parse(tool?.inputSchema)) : z.object({});

  if (isAgentLoading || error) return null;

  if (!tool)
    return (
      <div className="px-4 py-8 text-center">
        <Txt variant="heading" tone="muted">
          Tool not found
        </Txt>
      </div>
    );

  if (!canExecuteTool)
    return (
      <div className="px-4 py-8 text-center">
        <Txt variant="caption" tone="muted">
          You don't have permission to execute tools.
        </Txt>
      </div>
    );

  return (
    <ToolExecutor
      executionResult={result}
      isExecutingTool={isExecutingTool}
      zodInputSchema={zodInputSchema}
      handleExecuteTool={handleExecuteTool}
      toolDescription={tool.description ?? ''}
      toolId={tool.id}
      requestContextEntityType="agent-tool"
      requestContextEntityId={`${agentId}:${tool.id}`}
    />
  );
};
