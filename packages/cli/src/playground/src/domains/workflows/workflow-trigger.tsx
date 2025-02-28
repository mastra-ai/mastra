import jsonSchemaToZod from 'json-schema-to-zod';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { Button } from '@/components/ui/button';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { useExecuteWorkflow, useWatchWorkflow, useResumeWorkflow, useWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunContext } from './workflow-run-context';

interface SuspendedStep {
  stepId: string;
  runId: string;
}

interface WorkflowPath {
  stepId: string;
}

export function WorkflowTrigger({ workflowId, setRunId }: { workflowId: string; setRunId: (runId: string) => void }) {
  const { result, setResult, payload, setPayload } = useContext(WorkflowRunContext);
  const { isLoading, workflow } = useWorkflow(workflowId);
  const { executeWorkflow, isExecutingWorkflow } = useExecuteWorkflow();
  const { watchWorkflow, watchResult, isWatchingWorkflow } = useWatchWorkflow();
  const { resumeWorkflow, isResumingWorkflow } = useResumeWorkflow();
  const [suspendedSteps, setSuspendedSteps] = useState<SuspendedStep[]>([]);

  const triggerSchema = workflow?.triggerSchema;

  const handleExecuteWorkflow = async (data: any) => {
    if (!workflow) return;

    watchWorkflow({ workflowId });

    const result = await executeWorkflow({
      workflowId,
      input: data,
    });

    setResult(result);
    setRunId(result.runId);
  };

  const handleResumeWorkflow = async (step: SuspendedStep & { context: any }) => {
    if (!workflow) return;

    const { stepId, runId, context } = step;
    const result = await resumeWorkflow({
      stepId,
      runId,
      context,
      workflowId,
    });

    setResult(result);
  };

  const workflowActivePaths = watchResult?.activePaths ?? [];

  useEffect(() => {
    if (!watchResult?.activePaths || !result?.runId) return;

    const suspended = watchResult.activePaths
      .filter((path: WorkflowPath) => watchResult.context?.steps?.[path.stepId]?.status === 'suspended')
      .map((path: WorkflowPath) => ({
        stepId: path.stepId,
        runId: result.runId,
      }));
    setSuspendedSteps(suspended);
  }, [watchResult, result]);

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

  if (!triggerSchema) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-[400px]">
        <div className="space-y-4">
          <div className="space-y-4 px-4">
            <Button className="w-full" disabled={isExecutingWorkflow} onClick={() => handleExecuteWorkflow(null)}>
              {isExecutingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trigger'}
            </Button>
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

  const zodInputSchema = resolveSerializedZodOutput(jsonSchemaToZod(parse(triggerSchema)));

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-[400px]">
      <div className="space-y-4">
        <div>
          {suspendedSteps.length > 0 ? (
            suspendedSteps?.map(step => (
              <div className="px-4">
                <Text variant="secondary" className="text-mastra-el-3" size="xs">
                  {step.stepId}
                </Text>
                <DynamicForm
                  schema={z.record(z.string(), z.any())}
                  isSubmitLoading={isResumingWorkflow}
                  submitButtonLabel="Resume"
                  onSubmit={data => {
                    handleResumeWorkflow({
                      stepId: step.stepId,
                      runId: step.runId,
                      context: data,
                    });
                  }}
                />
              </div>
            ))
          ) : (
            <></>
          )}

          <div className="flex items-center justify-between w-full">
            <Text variant="secondary" className="text-mastra-el-3 px-4" size="xs">
              Input
            </Text>
            {isResumingWorkflow ? (
              <span className="flex items-center gap-1">
                <Loader2 className="animate-spin w-3 h-3 text-mastra-el-accent" /> Resuming workflow
              </span>
            ) : (
              <></>
            )}
          </div>
          <DynamicForm
            schema={zodInputSchema}
            defaultValues={payload}
            isSubmitLoading={isExecutingWorkflow}
            onSubmit={data => {
              setPayload(data);
              handleExecuteWorkflow(data);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          {workflowActivePaths.length > 0 &&
            workflowActivePaths?.map((activePath: any, idx: number) => {
              return (
                <div key={idx} className="flex flex-col gap-1">
                  {activePath?.stepPath?.map((sp: any, idx: number) => {
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
                          {sp}{' '}
                          {activePath?.status === 'completed'
                            ? `completed 🟢`
                            : sp === activePath?.stepId
                              ? `${activePath?.status} 🟡`
                              : `completed 🟢`}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
