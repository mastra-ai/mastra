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
import { toast } from 'sonner';

interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
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
  const { createWorkflowRun, startWorkflowRun } = useExecuteWorkflow(baseUrl);
  const { watchWorkflow, watchResult, isWatchingWorkflow } = useWatchWorkflow(baseUrl);
  const { resumeWorkflow, isResumingWorkflow } = useResumeWorkflow(baseUrl);
  const [suspendedSteps, setSuspendedSteps] = useState<SuspendedStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const triggerSchema = workflow?.triggerSchema;

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!workflow) return;
      setIsRunning(true);

      setResult(null);

      const { runId } = await createWorkflowRun({ workflowId });

      setRunId?.(runId);

      watchWorkflow({ workflowId, runId });

      startWorkflowRun({ workflowId, runId, input: data });
    } catch (err) {
      setIsRunning(false);
      toast.error('Error executing workflow');
    }
  };

  const handleResumeWorkflow = async (step: SuspendedStep & { context: any }) => {
    if (!workflow) return;

    const { stepId, runId: prevRunId, context } = step;

    const { runId } = await createWorkflowRun({ workflowId, prevRunId });

    watchWorkflow({ workflowId, runId });

    await resumeWorkflow({
      stepId,
      runId,
      context,
      workflowId,
    });
  };

  const watchResultToUse = result ?? watchResult;

  const workflowActivePaths = watchResultToUse?.activePaths ?? [];

  useEffect(() => {
    setIsRunning(isWatchingWorkflow);
  }, [isWatchingWorkflow]);

  useEffect(() => {
    if (!watchResultToUse?.activePaths || !result?.runId) return;

    const suspended = Object.entries(watchResultToUse.activePaths)
      .filter(([_, { status }]) => status === 'suspended')
      .map(([stepId, { suspendPayload }]) => ({
        stepId,
        runId: result.runId,
        suspendPayload,
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
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </ScrollArea>
    );
  }

  if (!workflow) return null;

  if (!triggerSchema) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-full">
        <div className="space-y-4">
          <div className="px-4 space-y-4">
            <Button className="w-full" disabled={isRunning} onClick={() => handleExecuteWorkflow(null)}>
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Trigger'}
            </Button>
          </div>

          <div>
            <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
              Output
            </Text>
            <div className="flex flex-col gap-2">
              <CopyButton
                classname="absolute z-40 w-8 h-8 p-0 transition-opacity duration-150 ease-in-out opacity-0 top-4 right-4 group-hover:opacity-100"
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

  const isSuspendedSteps = suspendedSteps.length > 0;

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-full">
      <div className="space-y-4">
        {!isSuspendedSteps && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between w-full">
              <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
                Input
              </Text>
              {isResumingWorkflow ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-mastra-el-accent" /> Resuming workflow
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
        )}

        {Object.values(workflowActivePaths).length > 0 && (
          <div className="flex flex-col gap-2">
            <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
              Status
            </Text>
            <div className="px-4 flex flex-col gap-4">
              {Object.entries(workflowActivePaths)?.map(([stepId, { status: pathStatus, stepPath }]) => {
                return (
                  <div className="flex flex-col gap-1">
                    {stepPath?.map((path, idx) => {
                      const status =
                        pathStatus === 'completed'
                          ? 'Completed'
                          : stepId === path
                            ? pathStatus.charAt(0).toUpperCase() + pathStatus.slice(1)
                            : 'Completed';

                      const statusIcon =
                        status === 'Completed' ? (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        );

                      return (
                        <div key={idx} className="flex flex-col overflow-hidden border">
                          <div className={`flex items-center justify-between p-3`}>
                            <Text variant="secondary" className="text-mastra-el-3" size="xs">
                              {path.charAt(0).toUpperCase() + path.slice(1)}
                            </Text>
                            <span className="flex items-center gap-2">
                              <Text variant="secondary" className="text-mastra-el-3" size="xs">
                                {statusIcon}
                              </Text>
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isSuspendedSteps &&
          suspendedSteps?.map(step => (
            <div className="flex flex-col px-4">
              <Text variant="secondary" className="text-mastra-el-3" size="xs">
                {step.stepId}
              </Text>
              {step.suspendPayload && (
                <div>
                  <CodeBlockDemo
                    className="w-[300px] overflow-x-auto p-2"
                    code={JSON.stringify(step.suspendPayload, null, 2)}
                    language="json"
                  />
                </div>
              )}
              <DynamicForm
                schema={z.record(z.string(), z.any())}
                isSubmitLoading={isResumingWorkflow}
                submitButtonLabel="Resume"
                onSubmit={data => {
                  handleResumeWorkflow({
                    stepId: step.stepId,
                    runId: step.runId,
                    suspendPayload: step.suspendPayload,
                    context: data,
                  });
                }}
              />
            </div>
          ))}

        {result && (
          <div className="flex flex-col">
            <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
              Output
            </Text>
            <div className="flex flex-col gap-2">
              <CopyButton
                classname="absolute z-40 w-8 h-8 p-0 transition-opacity duration-150 ease-in-out opacity-0 top-4 right-4 group-hover:opacity-100"
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
