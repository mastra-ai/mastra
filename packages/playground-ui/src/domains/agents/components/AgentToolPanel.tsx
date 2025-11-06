import { usePlaygroundStore } from '@/store/playground-store';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import jsonSchemaToZod from 'json-schema-to-zod';
import { parse } from 'superjson';
import { z } from 'zod';
import { Txt } from '@/ds/components/Txt';
import { useExecuteAgentTool } from '../hooks/use-execute-agent-tool';
import { useAgent } from '../hooks/use-agent';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';
import { toast } from '@/lib/toast';
import { useEffect } from 'react';

export interface AgentToolPanelProps {
  toolId: string;
  agentId: string;
}

export const AgentToolPanel = ({ toolId, agentId }: AgentToolPanelProps) => {
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);

  const tool = Object.values(agent?.tools ?? {}).find(tool => tool.id === toolId);

  const { mutateAsync: executeTool, isPending: isExecutingTool, data: result } = useExecuteAgentTool();
  const { requestContext: playgroundRequestContext } = usePlaygroundStore();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agent';
      toast.error(`Error loading agent: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    await executeTool({
      agentId: agentId!,
      toolId: tool.id,
      input: data,
      playgroundRequestContext,
    });
  };

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  if (isAgentLoading || error) return null;

  if (!tool)
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="header-md" className="text-icon3">
          Tool not found
        </Txt>
      </div>
    );

  return (
    <ToolExecutor
      executionResult={result}
      isExecutingTool={isExecutingTool}
      zodInputSchema={zodInputSchema}
      handleExecuteTool={handleExecuteTool}
      toolDescription={tool.description}
      toolId={tool.id}
    />
  );
};
