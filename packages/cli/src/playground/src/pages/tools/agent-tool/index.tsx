import jsonSchemaToZod from 'json-schema-to-zod';
import { useState } from 'react';
import { useParams } from 'react-router';
import { parse } from 'superjson';
import { z } from 'zod';

import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/copy-button';
import { Header } from '@/components/ui/header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { useAgent } from '@/hooks/use-agents';
import { useExecuteTool } from '@/hooks/use-execute-agent-tool';

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
      <div className="flex flex-col h-full w-full bg-mastra-bg-1">
        <Header title="Loading..." />
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

  const breadcrumbItems = [
    {
      label: 'Agents',
      href: '/agents',
    },
    {
      label: agentId,
      href: `/agents/${agentId}/chat`,
    },
    {
      label: toolId,
      href: `/agents/${agentId}/tools/${toolId}`,
      isCurrent: true,
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-mastra-bg-1">
      <Header title={<Breadcrumb items={breadcrumbItems} />} />
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
          <ScrollArea className="h-[calc(100vh-120px)] w-full">
            <CodeBlockDemo code={JSON.stringify(result ?? {}, null, 2)} language="json" />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default AgentTool;
