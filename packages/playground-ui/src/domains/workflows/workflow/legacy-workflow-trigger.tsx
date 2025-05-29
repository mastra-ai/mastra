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

import { useExecuteWorkflow, useWatchWorkflow, useResumeWorkflow, useLegacyWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { LegacyWorkflowStatus } from './legacy-workflow-status';

import { WorkflowResult } from './workflow-result';

interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
}

export function LegacyWorkflowTrigger({
  workflowId,
  setRunId,
}: {
  workflowId: string;
  setRunId?: (runId: string) => void;
}) {
  const { legacyResult: result, setLegacyResult: setResult, payload, setPayload } = useContext(WorkflowRunContext);
  const { isLoading, legacyWorkflow: workflow } = useLegacyWorkflow(workflowId);
  const { createLegacyWorkflowRun: createWorkflowRun, startLegacyWorkflowRun: startWorkflowRun } = useExecuteWorkflow();
  const {
    watchLegacyWorkflow: watchWorkflow,
    legacyWatchResult: watchResult,
    isWatchingLegacyWorkflow: isWatchingWorkflow,
  } = useWatchWorkflow();
  const { resumeLegacyWorkflow: resumeWorkflow, isResumingLegacyWorkflow: isResumingWorkflow } = useResumeWorkflow();
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

  const workflowActivePaths = watchResultToUse?.activePaths ?? {};

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

        {isSuspendedSteps &&
          suspendedSteps?.map(step => {
            const stepDefinition = workflow.steps[step.stepId];
            const stepSchema = stepDefinition?.inputSchema
              ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.inputSchema)))
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
                      context: data,
                    });
                  }}
                />
              </div>
            );
          })}

        {hasWorkflowActivePaths && (
          <>
            <hr className="border-border1 border-sm my-5" />
            <div className="flex flex-col gap-4">
              {Object.entries(workflowActivePaths)?.map(([stepId, { status: pathStatus, stepPath }]) => {
                return (
                  <div className="flex flex-col gap-1" key={stepId}>
                    {stepPath?.map((path, idx) => {
                      return <LegacyWorkflowStatus stepId={stepId} pathStatus={pathStatus} path={path} key={idx} />;
                    })}
                  </div>
                );
              })}
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
