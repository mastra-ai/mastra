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

import { useExecuteWorkflow, useWatchWorkflow, useResumeWorkflow, useVNextWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { usePlaygroundStore } from '@/store/playground-store';
interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
}

export function VNextWorkflowTrigger({
  workflowId,
  baseUrl,
  setRunId,
}: {
  workflowId: string;
  baseUrl: string;
  setRunId?: (runId: string) => void;
}) {
  const { runtimeContext } = usePlaygroundStore();
  const { vNextResult, setVNextResult, payload, setPayload } = useContext(WorkflowRunContext);
  const { isLoading, vNextWorkflow } = useVNextWorkflow(workflowId, baseUrl);
  const { createVNextWorkflowRun, startVNextWorkflowRun } = useExecuteWorkflow(baseUrl);
  const { watchVNextWorkflow, watchVNextResult, isWatchingVNextWorkflow } = useWatchWorkflow(baseUrl);
  const { resumeVNextWorkflow, isResumingVNextWorkflow } = useResumeWorkflow(baseUrl);
  const [suspendedSteps, setSuspendedSteps] = useState<SuspendedStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const triggerSchema = vNextWorkflow?.inputSchema;

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!vNextWorkflow) return;
      setIsRunning(true);

      setVNextResult(null);

      const { runId } = await createVNextWorkflowRun({ workflowId });

      setRunId?.(runId);

      watchVNextWorkflow({ workflowId, runId });

      startVNextWorkflowRun({ workflowId, runId, input: data, runtimeContext });
    } catch (err) {
      setIsRunning(false);
      toast.error('Error executing workflow');
    }
  };

  const handleResumeWorkflow = async (step: SuspendedStep & { resumeData: any }) => {
    if (!vNextWorkflow) return;

    const { stepId, runId: prevRunId, resumeData } = step;

    const { runId } = await createVNextWorkflowRun({ workflowId, prevRunId });

    watchVNextWorkflow({ workflowId, runId });

    await resumeVNextWorkflow({
      step: stepId,
      runId,
      resumeData,
      workflowId,
      runtimeContext,
    });
  };

  const watchResultToUse = vNextResult ?? watchVNextResult;

  const workflowActivePaths = watchResultToUse?.payload?.workflowState?.steps ?? {};

  useEffect(() => {
    setIsRunning(isWatchingVNextWorkflow);
  }, [isWatchingVNextWorkflow]);

  useEffect(() => {
    if (!watchResultToUse?.payload?.workflowState?.steps || !vNextResult?.runId) return;

    const suspended = Object.entries(watchResultToUse.payload.workflowState.steps)
      .filter(([_, { status }]) => status === 'suspended')
      .map(([stepId, { payload }]) => ({
        stepId,
        runId: vNextResult.runId,
        suspendPayload: payload,
      }));
    setSuspendedSteps(suspended);
  }, [watchResultToUse, vNextResult]);

  useEffect(() => {
    if (watchVNextResult) {
      setVNextResult(watchVNextResult);
    }
  }, [watchVNextResult]);

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

  if (!vNextWorkflow) return null;

  const isSuspendedSteps = suspendedSteps.length > 0;

  const zodInputSchema = triggerSchema ? resolveSerializedZodOutput(jsonSchemaToZod(parse(triggerSchema))) : null;

  const { sanitizedOutput, ...restResult } = vNextResult ?? {};

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs w-full">
      <div className="space-y-4">
        {!isSuspendedSteps && (
          <>
            {zodInputSchema ? (
              <div className="flex flex-col">
                <div className="flex items-center justify-between w-full">
                  <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
                    Input
                  </Text>
                  {isResumingVNextWorkflow ? (
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
                  isSubmitLoading={isWatchingVNextWorkflow}
                  onSubmit={data => {
                    setPayload(data);
                    handleExecuteWorkflow(data);
                  }}
                />
              </div>
            ) : (
              <div className="px-4 space-y-4">
                {isResumingVNextWorkflow ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-mastra-el-accent" /> Resuming workflow
                  </span>
                ) : (
                  <></>
                )}
                <Button className="w-full" disabled={isRunning} onClick={() => handleExecuteWorkflow(null)}>
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Trigger'}
                </Button>
              </div>
            )}
          </>
        )}

        {Object.values(workflowActivePaths).length > 0 && (
          <div className="flex flex-col gap-2">
            <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
              Status
            </Text>
            <div className="px-4 flex flex-col gap-4">
              {Object.entries(workflowActivePaths)
                ?.filter(([key, _]) => key !== 'input' && !key.endsWith('.input'))
                ?.map(([stepId, { status }]) => {
                  const statusIcon =
                    status === 'success' ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    ) : status === 'failed' ? (
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    ) : (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    );
                  return (
                    <div className="flex flex-col gap-1">
                      <div key={stepId} className="flex flex-col overflow-hidden rounded-md border">
                        <div className={`flex items-center justify-between p-3`}>
                          <Text variant="secondary" className="text-mastra-el-3" size="xs">
                            {stepId.charAt(0).toUpperCase() + stepId.slice(1)}
                          </Text>
                          <span className="flex items-center gap-2 capitalize">
                            <Text variant="secondary" className="text-mastra-el-3" size="xs">
                              {statusIcon}
                            </Text>
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {!isWatchingVNextWorkflow &&
          isSuspendedSteps &&
          suspendedSteps?.map(step => {
            const stepDefinition = vNextWorkflow.steps[step.stepId];
            const stepSchema = stepDefinition?.resumeSchema
              ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.resumeSchema)))
              : z.record(z.string(), z.any());
            return (
              <div className="flex flex-col px-4">
                <Text variant="secondary" className="text-mastra-el-3" size="xs">
                  {step.stepId}
                </Text>
                {step.suspendPayload && (
                  <div>
                    <CodeBlockDemo
                      className="w-full overflow-x-auto p-2"
                      code={JSON.stringify(step.suspendPayload, null, 2)}
                      language="json"
                    />
                  </div>
                )}
                <DynamicForm
                  schema={stepSchema}
                  isSubmitLoading={isResumingVNextWorkflow}
                  submitButtonLabel="Resume"
                  onSubmit={data => {
                    handleResumeWorkflow({
                      stepId: step.stepId,
                      runId: step.runId,
                      suspendPayload: step.suspendPayload,
                      resumeData: data,
                    });
                  }}
                />
              </div>
            );
          })}

        {vNextResult && (
          <div className="flex flex-col group relative">
            <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
              Output
            </Text>
            <div className="flex flex-col gap-2">
              <CopyButton
                classname="absolute z-40 w-8 h-8 p-0 transition-opacity duration-150 ease-in-out opacity-0 top-4 right-4 group-hover:opacity-100"
                content={JSON.stringify(restResult, null, 2)}
              />
            </div>
            <CodeBlockDemo
              className="w-full overflow-x-auto"
              code={sanitizedOutput || JSON.stringify(restResult, null, 2)}
              language="json"
            />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
