import jsonSchemaToZod from 'json-schema-to-zod';
import { useState } from 'react';
import { parse } from 'superjson';

import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { useExecuteWorkflow } from '@/hooks/use-workflows';
import { useWorkflow } from '@/hooks/use-workflows';

export function WorkflowTrigger({ workflowId, setRunId }: { workflowId: string; setRunId: (runId: string) => void }) {
  const { isLoading, workflow } = useWorkflow(workflowId);
  const { executeWorkflow, isExecutingWorkflow } = useExecuteWorkflow();
  const [result, setResult] = useState<any>(null);

  const triggerSchema = workflow?.triggerSchema;

  const handleExecuteWorkflow = async (data: any) => {
    if (!workflow) return;

    const result = await executeWorkflow({
      workflowId,
      input: data,
    });
    setResult(result);
    setRunId(result.runId);
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (!workflow) return null;

  const zodInputSchema = resolveSerializedZodOutput(jsonSchemaToZod(parse(triggerSchema)));

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-[400px]">
      <div className="space-y-4">
        <div>
          <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
            Input
          </Text>
          <DynamicForm
            schema={zodInputSchema}
            isSubmitLoading={isExecutingWorkflow}
            onSubmit={data => {
              handleExecuteWorkflow(data);
            }}
          />
        </div>

        <div>
          <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
            Output
          </Text>
          <div className="flex flex-col gap-2">
            <CopyButton
              classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
              content={JSON.stringify(result ?? {}, null, 2)}
            />
          </div>
          <CodeBlockDemo
            className="w-[368px] overflow-x-auto"
            code={JSON.stringify(result ?? {}, null, 2)}
            language="json"
          />
        </div>
      </div>
    </ScrollArea>
  );
}