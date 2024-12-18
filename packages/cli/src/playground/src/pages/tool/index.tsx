import { DynamicForm } from '@shared/components/dynamic-form';
import { resolveSerializedZodOutput } from '@shared/components/dynamic-form/utils';
import { CodeBlockDemo } from '@shared/components/ui/code-block';
import { CopyButton } from '@shared/components/ui/copy-button';
import { Header } from '@shared/components/ui/header';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Text } from '@shared/components/ui/text';
import { useAgent, useAgents } from '@shared/hooks/use-agents';
import { useExecuteTool } from '@shared/hooks/use-execute-tools';
import jsonSchemaToZod from 'json-schema-to-zod';
import { useState } from 'react';
import { useParams } from 'react-router';
import { parse } from 'superjson';

const Tool = () => {
  const { toolId, agentId } = useParams();
  const { agents, isLoading: isAgentsLoading } = useAgents();
  const { executeTool, isExecutingTool } = useExecuteTool();
  const [result, setResult] = useState<any>(null);

  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const tool = agent?.tools[toolId as keyof typeof agent.tools];

  if (!agent) {
    console.log(`Agent ${agentId} not found`);
    return null;
  }

  if (!tool) {
    console.log(`Tool ${toolId} not found`);
    return null;
  }

  const handleExecuteTool = async (data: any) => {
    if (isAgentsLoading) return;

    const agent = Object.entries(agents)
      .map(([key, agent]) => ({
        ...agent,
        key,
      }))
      .find(agent => Object.values(agent.tools).find(tool => tool.id === tool.id));

    if (!agent) {
      console.log(`Agent for tool ${tool.id} not found`);
      return;
    }

    const result = await executeTool({
      agentId: agent.key,
      toolId: tool.id,
      input: data,
    });
    setResult(result);
  };

  const zodInputSchema = resolveSerializedZodOutput(jsonSchemaToZod(parse(tool.inputSchema)));

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-mastra-bg-1">
        <Header title="Loading..." />
        <div className="w-full h-full grid grid-cols-[1fr_2fr] p-2 gap-2">
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

  return (
    <div className="flex flex-col h-full w-full bg-mastra-bg-1">
      <Header title={`Tool - ${toolId}`} />
      <div className="w-full h-full grid grid-cols-[1fr_2fr] p-2 gap-2">
        <div className="flex flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
          <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
            Input
          </Text>
          <DynamicForm
            isSubmitLoading={isExecutingTool}
            schema={zodInputSchema}
            onSubmit={data => {
              handleExecuteTool(data);
            }}
          />
        </div>
        <div className="flex relative group flex-col gap-4 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2 p-4 py-6">
          <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
            Output
          </Text>
          <div className="flex flex-col  gap-2">
            <CopyButton
              classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
              content={JSON.stringify(result ?? {}, null, 2)}
            />
          </div>
          <CodeBlockDemo code={JSON.stringify(result ?? {}, null, 2)} language="json" />
        </div>
      </div>
    </div>
  );
};

export default Tool;
