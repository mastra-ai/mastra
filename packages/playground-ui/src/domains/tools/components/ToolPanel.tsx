import { usePlaygroundStore } from '@/store/playground-store';
import { useTool } from '@/domains/tools/hooks';
import { useExecuteTool } from '@/domains/tools/hooks/use-execute-tool';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import jsonSchemaToZod from 'json-schema-to-zod';
import { parse } from 'superjson';
import { z } from 'zod';
import { Txt } from '@/ds/components/Txt';
import ToolExecutor from './ToolExecutor';

export interface ToolPanelProps {
  toolId: string;
}

export const ToolPanel = ({ toolId }: ToolPanelProps) => {
  const { data: tool, isLoading } = useTool(toolId!);

  const { mutateAsync: executeTool, isPending: isExecuting, data: result } = useExecuteTool();
  const { runtimeContext: playgroundRuntimeContext } = usePlaygroundStore();

  const handleExecuteTool = async (data: any) => {
    if (!tool) return;

    return executeTool({
      toolId: tool.id,
      input: data,
      runtimeContext: playgroundRuntimeContext,
    });
  };

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  if (isLoading) return null;
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
