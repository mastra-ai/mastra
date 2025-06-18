import jsonSchemaToZod from 'json-schema-to-zod';
import { Braces, Footprints, Loader2 } from 'lucide-react';
import { useState, useEffect, useContext, useId } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import { DynamicForm } from '@/components/dynamic-form';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { Button } from '@/ds/components/Button';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { ExtendedWorkflowWatchResult } from '@/hooks/use-workflows';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { usePlaygroundStore } from '@/store/playground-store';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';

import { GetWorkflowResponse } from '@mastra/client-js';
import { SyntaxHighlighter } from '@/components/ui/syntax-highlighter';
import { Input } from '@/components/ui/input';
import { Dialog, DialogPortal, DialogTitle, DialogContent } from '@/components/ui/dialog';

interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
}

interface WorkflowTriggerProps {
  workflowId: string;
  setRunId?: (runId: string) => void;
  workflow?: GetWorkflowResponse;
  isLoading?: boolean;
  createWorkflowRun: ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => Promise<{
    runId: string;
  }>;
  startWorkflowRun: ({
    workflowId,
    runId,
    input,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    input: Record<string, unknown>;
    runtimeContext: Record<string, unknown>;
  }) => Promise<void>;
  resumeWorkflow: ({
    workflowId,
    step,
    runId,
    resumeData,
    runtimeContext,
  }: {
    workflowId: string;
    step: string | string[];
    runId: string;
    resumeData: Record<string, unknown>;
    runtimeContext: Record<string, unknown>;
  }) => Promise<{
    message: string;
  }>;
  watchWorkflow: ({ workflowId, runId }: { workflowId: string; runId: string }) => Promise<void>;
  watchResult: ExtendedWorkflowWatchResult | null;
  isWatchingWorkflow: boolean;
  isResumingWorkflow: boolean;
}

export function WorkflowTrigger({
  workflowId,
  setRunId,
  workflow,
  isLoading,
  createWorkflowRun,
  startWorkflowRun,
  resumeWorkflow,
  watchWorkflow,
  watchResult,
  isWatchingWorkflow,
  isResumingWorkflow,
}: WorkflowTriggerProps) {
  const { runtimeContext } = usePlaygroundStore();
  const { result, setResult, payload, setPayload } = useContext(WorkflowRunContext);

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
        isLoading: false,
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
  const { sanitizedOutput, ...restResult } = result || {};

  return (
    <div className="h-full pt-3 pb-12">
      <div className="space-y-4 px-5 pb-5 border-b-sm border-border1">
        {(isResumingWorkflow || (isSuspendedSteps && isWatchingWorkflow)) && (
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
                      isLoading: false,
                    });
                  }}
                />
              </div>
            );
          })}
      </div>
      {result && (
        <div className="p-5 border-b-sm border-border1">
          <WorkflowJsonDialog result={restResult} />
        </div>
      )}
      {result && <WorkflowResultSection result={result} workflow={workflow} />}
    </div>
  );
}

interface WorkflowResultSectionProps {
  result: ExtendedWorkflowWatchResult;
  workflow: GetWorkflowResponse;
}

const WorkflowResultSection = ({ result, workflow }: WorkflowResultSectionProps) => {
  const workflowState = result.payload.workflowState as ExtendedWorkflowWatchResult['payload']['workflowState'] & {
    result: unknown | null;
  };

  const hasResult = Object.keys(workflowState.steps || {}).length > 0;
  if (!hasResult) return null;

  return (
    <div className="p-5">
      <Txt variant="ui-sm" className="text-icon3">
        Final Output
      </Txt>
      <ul className="pt-4">
        {Object.entries(workflowState.steps || {}).map(([stepId, stepResult]) => {
          const stepDefinition = workflow.steps[stepId];
          if (!stepDefinition) return null;

          return (
            <li
              key={stepId}
              className="border-b-sm border-dashed border-border1 last:border-b-0 py-4 first:pt-0 last:pb-0"
            >
              <WorkflowResultFinishedStep stepResult={stepResult.output} stepDefinition={stepDefinition} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface WorkflowResultFinishedStepProps {
  stepResult: unknown;
  stepDefinition: GetWorkflowResponse['steps'][string];
}

const WorkflowResultFinishedStep = ({ stepResult, stepDefinition }: WorkflowResultFinishedStepProps) => {
  const id = useId();

  try {
    const zodObjectSchema = resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.outputSchema)));

    if (zodObjectSchema?._def?.typeName === 'ZodString') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon>
              <Footprints className="text-icon3" />
            </Icon>

            <Txt as="label" htmlFor={id} variant="ui-sm" className="text-icon3">
              {stepDefinition.description || stepDefinition.id}
            </Txt>
          </div>
          <Input id={id} defaultValue={stepResult as string} readOnly />
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-2 pb-2">
          <Icon>
            <Footprints className="text-icon3" />
          </Icon>
          <Txt variant="ui-sm" className="text-icon3">
            {stepDefinition.description || stepDefinition.id}
          </Txt>
        </div>
        <DynamicForm
          key={JSON.stringify(stepResult)}
          schema={zodObjectSchema}
          defaultValues={stepResult as Record<string, unknown>}
          readOnly
        />
      </div>
    );
  } catch (err: unknown) {
    console.error('Error parsing output schema', err);
    return <Txt>An error occured. Please open an issue on GitHub.</Txt>;
  }
};

const WorkflowJsonDialog = ({ result }: { result: Record<string, unknown> }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="light" onClick={() => setOpen(true)} className="w-full" size="lg">
        <Icon>
          <Braces className="text-icon3" />
        </Icon>
        Open Workflow Execution (JSON)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-surface2">
            <DialogTitle>Workflow Execution (JSON)</DialogTitle>
            <div className="w-full h-full overflow-x-scroll">
              <SyntaxHighlighter data={result} className="p-4" />
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};
