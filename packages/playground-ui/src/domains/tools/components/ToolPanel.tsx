import { usePlaygroundStore } from '@/store/playground-store';
import { useTool } from '@/domains/tools/hooks';
import { useExecuteTool } from '@/domains/tools/hooks/use-execute-tool';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import jsonSchemaToZod from 'json-schema-to-zod';
import { parse } from 'superjson';
import { z } from 'zod';
import { Txt } from '@/ds/components/Txt';
import ToolExecutor from './ToolExecutor';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useMemo, useEffect } from 'react';
import { toast } from '@/lib/toast';

export interface ToolPanelProps {
  toolId: string;
}

export const ToolPanel = ({ toolId }: ToolPanelProps) => {
  const { data: agents = {} } = useAgents();

  // Check if tool exists in any agent's tools
  const agentTool = useMemo(() => {
    for (const agent of Object.values(agents)) {
      if (agent.tools) {
        const tool = Object.values(agent.tools).find(t => t.id === toolId);
        if (tool) {
          return tool;
        }
      }
    }
    return null;
  }, [agents, toolId]);

  // Only fetch from API if tool not found in agents
  const { data: apiTool, isLoading, error } = useTool(toolId!, { enabled: !agentTool });

  const tool: any = agentTool || apiTool;

  const { mutateAsync: executeTool, isPending: isExecuting, data: result } = useExecuteTool();
  const { requestContext: playgroundRequestContext } = usePlaygroundStore();

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tool';
      toast.error(`Error loading tool: ${errorMessage}`);
    }
  }, [error]);

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    return executeTool({
      toolId: tool.id,
      input: data,
      requestContext: playgroundRequestContext,
    });
  };

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  if (isLoading || error) return null;

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
      isExecutingTool={isExecuting}
      zodInputSchema={zodInputSchema}
      handleExecuteTool={handleExecuteTool}
      toolDescription={tool.description}
      toolId={tool.id}
    />
  );
};
