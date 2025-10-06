import { jsonSchemaToZod } from 'json-schema-to-zod';

import { Link, useParams } from 'react-router';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';

import { useTool } from '@/hooks/use-all-tools';
import { useExecuteTool } from '@/hooks/use-execute-tool';

import ToolExecutor from '../tool-executor';
import {
  Header,
  Breadcrumb,
  Crumb,
  usePlaygroundStore,
  Txt,
  Icon,
  ToolsIcon,
  HeaderAction,
  Button,
  DocsIcon,
} from '@mastra/playground-ui';

const Tool = () => {
  const { toolId } = useParams();
  const { tool, isLoading } = useTool(toolId!);

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

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/tools`}>
            <Icon>
              <ToolsIcon />
            </Icon>
            Tools
          </Crumb>
          <Crumb as={Link} to={`/tools/all/${toolId}`} isCurrent>
            {toolId}
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>
      {isLoading ? null : !tool ? (
        <div className="py-12 text-center px-6">
          <Txt variant="header-md" className="text-icon3">
            Tool not found
          </Txt>
        </div>
      ) : (
        <ToolExecutor
          executionResult={result}
          isExecutingTool={isExecuting}
          zodInputSchema={zodInputSchema}
          handleExecuteTool={handleExecuteTool}
          toolDescription={tool.description}
          toolId={tool.id}
        />
      )}
    </div>
  );
};

export default Tool;
