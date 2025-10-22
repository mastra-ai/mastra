import jsonSchemaToZod from 'json-schema-to-zod';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { useAgent } from '@mastra/playground-ui';
import { useExecuteTool } from '@/hooks/use-execute-agent-tool';

import ToolExecutor from '../tool-executor';
import {
  Header,
  Crumb,
  Breadcrumb,
  usePlaygroundStore,
  Txt,
  MainContentLayout,
  AgentIcon,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
} from '@mastra/playground-ui';

const AgentTool = () => {
  const { toolId, agentId } = useParams();
  const { runtimeContext: playgroundRuntimeContext } = usePlaygroundStore();

  const { mutateAsync: executeTool, isPending: isExecutingTool, error } = useExecuteTool();
  const [result, setResult] = useState<any>(null);

  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);

  const tool = Object.values(agent?.tools ?? {}).find(tool => tool.id === toolId);

  const handleExecuteTool = async (data: any) => {
    if (!agent || !tool) return;

    const result = await executeTool({
      agentId: agentId!,
      toolId: tool.id,
      input: data,
      playgroundRuntimeContext,
    });
    setResult(result);
  };

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  const shouldShowEmpty = !agent || !tool;

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/agents`}>
            <Icon>
              <AgentIcon />
            </Icon>
            Agents
          </Crumb>
          <Crumb as={Link} to={`/agents/${agentId}/chat`}>
            {agentId}
          </Crumb>
          <Crumb as={Link} to={`/tools/${agentId}/${toolId}`} isCurrent>
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

      {isAgentLoading ? null : shouldShowEmpty ? (
        <div className="py-12 text-center px-6">
          <Txt variant="header-md" className="text-icon3">
            Agent or tool not found
          </Txt>
        </div>
      ) : (
        <ToolExecutor
          executionResult={result}
          errorString={error?.message ?? ''}
          isExecutingTool={isExecutingTool}
          zodInputSchema={zodInputSchema}
          handleExecuteTool={handleExecuteTool}
          toolDescription={tool.description}
          toolId={tool.id}
        />
      )}
    </MainContentLayout>
  );
};

export default AgentTool;
