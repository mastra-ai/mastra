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
import { WorkflowRunContext } from '../context/workflow-run-context';

interface SuspendedStep {
  stepId: string;
  runId: string;
}

interface WorkflowPath {
  stepId: string;
}

export function WorkflowTrigger({
  workflowId,
  baseUrl,
  setRunId,
}: {
  workflowId: string;
  baseUrl: string;
  setRunId?: (runId: string) => void;
}) {
  const { result, setResult, payload, setPayload } = useContext(WorkflowRunContext);
  const { isLoading, workflow } = useWorkflow(workflowId, baseUrl);
  const { createWorkflowRun } = useExecuteWorkflow(baseUrl);
  const { watchWorkflow, watchResult, isWatchingWorkflow } = useWatchWorkflow(baseUrl);
  const { resumeWorkflow, isResumingWorkflow } = useResumeWorkflow(baseUrl);
  const [suspendedSteps, setSuspendedSteps] = useState<SuspendedStep[]>([]);

  const triggerSchema = workflow?.triggerSchema;

  const handleExecuteWorkflow = async (data: any) => {
    if (!workflow) return;

    setResult(null);

    const { runId } = await createWorkflowRun({ workflowId, input: data });
    setRunId?.(runId);

    watchWorkflow({ workflowId, runId });
  };

  const handleResumeWorkflow = async (step: SuspendedStep & { context: any }) => {
    if (!workflow) return;

    const { stepId, runId, context } = step;

    resumeWorkflow({
      stepId,
      runId,
      context,
      workflowId,
    });

    watchWorkflow({ workflowId, runId });
  };

  const watchResultToUse = result ?? watchResult;

  const workflowActivePaths = watchResultToUse?.activePaths ?? [];

  useEffect(() => {
    if (!watchResultToUse?.activePaths || !result?.runId) return;

    const suspended = watchResultToUse.activePaths
      .filter((path: WorkflowPath) => watchResultToUse.context?.steps?.[path.stepId]?.status === 'suspended')
      .map((path: WorkflowPath) => ({
        stepId: path.stepId,
        runId: result.runId,
      }));
    setSuspendedSteps(suspended);
  }, [watchResultToUse, result]);

  useEffect(() => {
    if (watchResult) {
      setResult(watchResult);
    }
  }, [watchResult]);

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
            <Button className="w-full" disabled={isWatchingWorkflow} onClick={() => handleExecuteWorkflow(null)}>
              {isWatchingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trigger'}
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
            isSubmitLoading={isWatchingWorkflow}
            onSubmit={data => {
              setPayload(data);
              handleExecuteWorkflow(data);
            }}
          />
        </div>
        {workflowActivePaths.length > 0 && (
          <div className="flex flex-col gap-2">
            <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
              Status
            </Text>
            <div className="px-4">
              {workflowActivePaths?.map((activePath: any, idx: number) => {
                return (
                  <div key={idx} className="flex flex-col mt-2 border  overflow-hidden">
                    {activePath?.stepPath?.map((sp: any, idx: number) => {
                      const status =
                        activePath?.status === 'completed'
                          ? 'Completed'
                          : sp === activePath?.stepId
                            ? activePath?.status.charAt(0).toUpperCase() + activePath?.status.slice(1)
                            : 'Completed';

                      const statusIcon =
                        status === 'Completed' ? (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-yellow-500 animate-pulse rounded-full" />
                        );

                      return (
                        <div
                          key={idx}
                          className={`
                            flex items-center justify-between p-3
                            ${idx !== activePath.stepPath.length - 1 ? 'border-b' : ''}
                            bg-white/5
                          `}
                        >
                          <Text variant="secondary" className="text-mastra-el-3" size="xs">
                            {sp.charAt(0).toUpperCase() + sp.slice(1)}
                          </Text>
                          <span className="flex items-center gap-2">
                            <Text variant="secondary" className="text-mastra-el-3" size="xs">
                              {statusIcon}
                            </Text>
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {result && (
          <div className="flex flex-col gap-2">
            <Text variant="secondary" className="text-mastra-el-3  px-4" size="xs">
              Output
            </Text>
            <div className="flex flex-col gap-2">
              <CopyButton
                classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
                content={JSON.stringify(result, null, 2)}
              />
            </div>
            <CodeBlockDemo
              className="w-[368px] overflow-x-auto"
              code={JSON.stringify(result, null, 2)}
              language="json"
            />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
