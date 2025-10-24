import { usePlaygroundStore } from '@/store/playground-store';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import jsonSchemaToZod from 'json-schema-to-zod';
import { parse } from 'superjson';
import { z } from 'zod';
import { Txt } from '@/ds/components/Txt';
import { useExecuteAgentTool } from '../hooks/use-execute-agent-tool';
import { useAgent } from '../hooks/use-agent';
import ToolExecutor from '@/domains/tools/components/ToolExecutor';

export interface AgentToolPanelProps {
  toolId: string;
  agentId: string;
}

export const AgentToolPanel = ({ toolId, agentId }: AgentToolPanelProps) => {
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);

  const tool = Object.values(agent?.tools ?? {}).find(tool => tool.id === toolId);

  const { mutateAsync: executeTool, isPending: isExecutingTool, data: result } = useExecuteAgentTool();
  const { runtimeContext: playgroundRuntimeContext } = usePlaygroundStore();

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    await executeTool({
      agentId: agentId!,
      toolId: tool.id,
      input: data,
      playgroundRuntimeContext,
    });
  };

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  if (isAgentLoading) return null;
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
