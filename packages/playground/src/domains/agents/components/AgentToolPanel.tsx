import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useEffect } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';
import { useAgent } from '../hooks/use-agent';
import { useExecuteAgentTool } from '../hooks/use-execute-agent-tool';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ToolOverview } from '@/domains/tools/components/tool-overview';
import { ToolUsedBy } from '@/domains/tools/components/tool-used-by';
import { ToolView } from '@/domains/tools/components/tool-view';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';
import { ToolInformation } from '@/domains/tools/components/ToolInformation';
import { parseToolSchema } from '@/domains/tools/utils/parse-tool-schema';

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

  const { mutateAsync: executeTool } = useExecuteAgentTool();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agent';
      toast.error(`Error loading agent: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = (data: unknown, requestContext?: Record<string, unknown>) =>
    executeTool({
      agentId,
      toolId,
      input: data,
      playgroundRequestContext: requestContext,
    });

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

  return (
    <ToolView
      header={
        <ToolInformation
          toolId={tool.id}
          toolDescription={tool.description ?? ''}
          requiresApproval={tool.requireApproval}
        />
      }
      overview={
        <ToolOverview
          inputSchema={parseToolSchema(tool.inputSchema)}
          outputSchema={parseToolSchema(tool.outputSchema)}
          requestContextSchema={parseToolSchema(tool.requestContextSchema)}
          aside={<ToolUsedBy toolId={tool.id} currentAgentId={agentId} />}
        />
      }
      playground={
        canExecuteTool ? (
          <ToolExecutor
            zodInputSchema={zodInputSchema}
            handleExecuteTool={handleExecuteTool}
            requestContextEntityType="agent-tool"
            requestContextEntityId={`${agentId}:${tool.id}`}
          />
        ) : undefined
      }
    />
  );
};
