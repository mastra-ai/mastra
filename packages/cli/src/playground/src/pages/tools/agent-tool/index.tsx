import jsonSchemaToZod from 'json-schema-to-zod';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { useAgent } from '@/hooks/use-agents';
import { useExecuteTool } from '@/hooks/use-execute-agent-tool';

import ToolExecutor from '../tool-executor';
import { HeaderTitle, Header, Crumb, Breadcrumb } from '@mastra/playground-ui';

const AgentTool = () => {
  const { toolId, agentId } = useParams();

  const { executeTool, isExecutingTool } = useExecuteTool();
  const [result, setResult] = useState<any>(null);

  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  const tool = Object.values(agent?.tools ?? {}).find(tool => tool.id === toolId);

  const handleExecuteTool = async (data: any) => {
    if (!agent || !tool) return;

    const result = await executeTool({
      agentId: agentId!,
      toolId: tool.id,
      input: data,
    });
    setResult(result);
  };

  if (isAgentLoading) {
    return (
      <div className="h-full w-full bg-mastra-bg-1">
        <Header>
          <HeaderTitle>Loading...</HeaderTitle>
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

  if (!agent || !tool) {
    return null;
  }

  const zodInputSchema = tool?.inputSchema
    ? resolveSerializedZodOutput(jsonSchemaToZod(parse(tool?.inputSchema)))
    : z.object({});

  return (
    <div className="h-full w-full bg-mastra-bg-1 overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/agents`}>
            Agents
          </Crumb>
          <Crumb as={Link} to={`/agents/${agentId}/chat`}>
            {agentId}
          </Crumb>
          <Crumb as={Link} to={`/agents/${agentId}/tools/${toolId}`} isCurrent>
            {toolId}
          </Crumb>
        </Breadcrumb>
      </Header>

      <ToolExecutor
        executionResult={result}
        isExecutingTool={isExecutingTool}
        zodInputSchema={zodInputSchema}
        handleExecuteTool={handleExecuteTool}
      />
    </div>
  );
};

export default AgentTool;
