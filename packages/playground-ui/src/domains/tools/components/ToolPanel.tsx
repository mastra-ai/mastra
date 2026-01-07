import { usePlaygroundStore } from '@/store/playground-store';
import { useTool } from '@/domains/tools/hooks';
import { useExecuteTool } from '@/domains/tools/hooks/use-execute-tool';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { z, ZodType } from 'zod';
import { Txt } from '@/ds/components/Txt';
import { ToolExecutor } from './ToolExecutor';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useMemo, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

export interface ToolPanelProps {
  toolId: string;
}

export const ToolPanel = ({ toolId }: ToolPanelProps) => {
  const { data: agents = {} } = useAgents();
  const [requestContextFormData, setRequestContextFormData] = useState<Record<string, any>>({});

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

  // Parse requestContextSchema if it exists
  const zodRequestContextSchema: ZodType | undefined = useMemo(() => {
    if (!tool?.requestContextSchema) return undefined;
    try {
      return resolveSerializedZodOutput(jsonSchemaToZod(parse(tool.requestContextSchema)));
    } catch (e) {
      console.error('Error parsing requestContextSchema:', e);
      return undefined;
    }
  }, [tool?.requestContextSchema]);

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    // Merge playground requestContext with form-based requestContext
    // Form values take precedence
    const mergedRequestContext = {
      ...playgroundRequestContext,
      ...requestContextFormData,
    };

    return executeTool({
      toolId: tool.id,
      input: data,
      requestContext: mergedRequestContext,
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
      zodRequestContextSchema={zodRequestContextSchema}
      initialRequestContextValues={playgroundRequestContext}
      onRequestContextChange={setRequestContextFormData}
      handleExecuteTool={handleExecuteTool}
      toolDescription={tool.description}
      toolId={tool.id}
    />
  );
};
