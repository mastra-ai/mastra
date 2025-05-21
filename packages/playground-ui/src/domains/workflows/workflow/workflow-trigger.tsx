import jsonSchemaToZod from 'json-schema-to-zod';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { Button } from '@/ds/components/Button';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { useExecuteWorkflow, useWatchWorkflow, useResumeWorkflow, useWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { usePlaygroundStore } from '@/store/playground-store';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { WorkflowStatus } from './workflow-status';
import { WorkflowResult } from './workflow-result';
interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
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
  const { runtimeContext } = usePlaygroundStore();
  const { result, setResult, payload, setPayload } = useContext(WorkflowRunContext);
  const { isLoading, workflow } = useWorkflow(workflowId, baseUrl);
  const { createWorkflowRun, startWorkflowRun } = useExecuteWorkflow(baseUrl);
  const { watchWorkflow, watchResult, isWatchingWorkflow } = useWatchWorkflow(baseUrl);
  const { resumeWorkflow, isResumingWorkflow } = useResumeWorkflow(baseUrl);
  const [suspendedSteps, setSuspendedSteps] = useState<SuspendedStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const triggerSchema = workflow?.inputSchema;

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!workflow) return;
      setIsRunning(true);

      setResult(null);

      const { runId } = await createWorkflowRun({ workflowId });

      setRunId?.(runId);

      watchWorkflow({ workflowId, runId });

      startWorkflowRun({ workflowId, runId, input: data, runtimeContext });
    } catch (err) {
      setIsRunning(false);
      toast.error('Error executing workflow');
    }
  };

  const handleResumeWorkflow = async (step: SuspendedStep & { resumeData: any }) => {
    if (!workflow) return;

    const { stepId, runId: prevRunId, resumeData } = step;

    const { runId } = await createWorkflowRun({ workflowId, prevRunId });

    watchWorkflow({ workflowId, runId });

    await resumeWorkflow({
      step: stepId,
      runId,
      resumeData,
      workflowId,
      runtimeContext,
    });
  };

  const watchResultToUse = result ?? watchResult;

  const workflowActivePaths = watchResultToUse?.payload?.workflowState?.steps ?? {};

  useEffect(() => {
    setIsRunning(isWatchingWorkflow);
  }, [isWatchingWorkflow]);

  useEffect(() => {
    if (!watchResultToUse?.payload?.workflowState?.steps || !result?.runId) return;

    const suspended = Object.entries(watchResultToUse.payload.workflowState.steps)
      .filter(([_, { status }]) => status === 'suspended')
      .map(([stepId, { payload }]) => ({
        stepId,
        runId: result.runId,
        suspendPayload: payload,
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

  const isSuspendedSteps = suspendedSteps.length > 0;

  const zodInputSchema = triggerSchema ? resolveSerializedZodOutput(jsonSchemaToZod(parse(triggerSchema))) : null;

  const { sanitizedOutput, ...restResult } = result ?? {};

  const hasWorkflowActivePaths = Object.values(workflowActivePaths).length > 0;

  return (
    <div className="h-full px-5 pt-3 pb-12">
      <div className="space-y-4">
        {isResumingWorkflow && (
          <div className="py-2 px-5 flex items-center gap-2 bg-surface5 -mx-5 -mt-5 border-b-sm border-border1">
            <Icon>
              <Loader2 className="animate-spin text-icon6" />
            </Icon>
            <Txt>Resuming workflow</Txt>
          </div>
        )}

        {!isSuspendedSteps && (
          <>
            {zodInputSchema ? (
              <DynamicForm
                schema={zodInputSchema}
                defaultValues={payload}
                isSubmitLoading={isWatchingWorkflow}
                submitButtonLabel="Run"
                onSubmit={data => {
                  setPayload(data);
                  handleExecuteWorkflow(data);
                }}
              />
            ) : (
              <Button
                className="w-full"
                variant="light"
                disabled={isRunning}
                onClick={() => handleExecuteWorkflow(null)}
              >
                {isRunning ? (
                  <Icon>
                    <Loader2 className="animate-spin" />
                  </Icon>
                ) : (
                  'Trigger'
                )}
              </Button>
            )}
          </>
        )}

        {!isWatchingWorkflow &&
          isSuspendedSteps &&
          suspendedSteps?.map(step => {
            const stepDefinition = workflow.steps[step.stepId];
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
                  isSubmitLoading={isResumingWorkflow}
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

        {hasWorkflowActivePaths && (
          <>
            <hr className="border-border1 border-sm my-5" />
            <div className="flex flex-col gap-2">
              <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
                Status
              </Text>
              <div className="px-4 flex flex-col gap-4">
                {Object.entries(workflowActivePaths)
                  ?.filter(([key, _]) => key !== 'input' && !key.endsWith('.input'))
                  ?.map(([stepId, { status }]) => {
                    return <WorkflowStatus stepId={stepId} status={status} />;
                  })}
              </div>
            </div>
          </>
        )}

        {result && (
          <>
            <hr className="border-border1 border-sm my-5" />
            <WorkflowResult sanitizedJsonResult={sanitizedOutput} jsonResult={JSON.stringify(restResult, null, 2)} />
          </>
        )}
      </div>
    </div>
  );
}
