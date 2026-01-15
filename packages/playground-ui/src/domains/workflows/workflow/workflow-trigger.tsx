import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { Braces, Loader2, StopCircle } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Skeleton } from '@/ds/components/Skeleton';

import { WorkflowRunContext, WorkflowRunStreamResult } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { usePlaygroundStore } from '@/store/playground-store';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';

import { GetWorkflowResponse } from '@mastra/client-js';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Dialog, DialogPortal, DialogTitle, DialogContent } from '@/ds/components/Dialog';
import { WorkflowStatus } from './workflow-status';
import { WorkflowInputData } from './workflow-input-data';
import { isObjectEmpty } from '@/lib/object';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
}

export interface WorkflowTriggerProps {
  workflowId: string;
  paramsRunId?: string;
  setRunId?: (runId: string) => void;
  workflow?: GetWorkflowResponse;
  isLoading?: boolean;
  createWorkflowRun: ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => Promise<{
    runId: string;
  }>;
  isStreamingWorkflow: boolean;
  streamWorkflow: ({
    workflowId,
    runId,
    inputData,
    initialState,
    requestContext,
    perStep,
  }: {
    workflowId: string;
    runId: string;
    inputData: Record<string, unknown>;
    initialState?: Record<string, unknown>;
    requestContext: Record<string, unknown>;
    perStep?: boolean;
  }) => Promise<void>;
  observeWorkflowStream?: ({ workflowId, runId }: { workflowId: string; runId: string }) => void;
  resumeWorkflow: ({
    workflowId,
    step,
    runId,
    resumeData,
    requestContext,
    perStep,
  }: {
    workflowId: string;
    step: string | string[];
    runId: string;
    resumeData: Record<string, unknown>;
    requestContext: Record<string, unknown>;
    perStep?: boolean;
  }) => Promise<void>;
  streamResult: WorkflowRunStreamResult | null;
  isCancellingWorkflowRun: boolean;
  cancelWorkflowRun: ({ workflowId, runId }: { workflowId: string; runId: string }) => Promise<{
    message: string;
  }>;
}

export function WorkflowTrigger({
  workflowId,
  paramsRunId,
  setRunId,
  workflow,
  isLoading,
  createWorkflowRun,
  resumeWorkflow,
  streamWorkflow,
  observeWorkflowStream,
  isStreamingWorkflow,
  streamResult,
  isCancellingWorkflowRun,
  cancelWorkflowRun,
}: WorkflowTriggerProps) {
  const { requestContext } = usePlaygroundStore();
  const { result, setResult, payload, setPayload, setRunId: setContextRunId } = useContext(WorkflowRunContext);
  const { canExecute } = usePermissions();

  // Check if user can execute workflows
  const canExecuteWorkflow = canExecute('workflows');

  const [isRunning, setIsRunning] = useState(false);
  const [innerRunId, setInnerRunId] = useState<string>('');
  const [cancelResponse, setCancelResponse] = useState<{ message: string } | null>(null);
  const triggerSchema = workflow?.inputSchema;
  const stateSchema = workflow?.stateSchema;

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!workflow) return;
      setIsRunning(true);

      setCancelResponse(null);

      setResult(null);

      const run = await createWorkflowRun({ workflowId });

      setRunId?.(run.runId);
      setInnerRunId(run.runId);
      setContextRunId(run.runId);
      const { initialState, inputData: dataInputData } = data ?? {};

      const inputData = stateSchema ? dataInputData : data;

      streamWorkflow({ workflowId, runId: run.runId, inputData, initialState, requestContext });
    } catch (err) {
      setIsRunning(false);
      toast.error('Error executing workflow');
    }
  };

  const handleResumeWorkflow = async (
    step: Omit<SuspendedStep, 'stepId'> & { resumeData: any; stepId: string | string[] },
  ) => {
    if (!workflow) return;

    setCancelResponse(null);
    const { stepId, runId: prevRunId, resumeData } = step;

    const run = await createWorkflowRun({ workflowId, prevRunId });

    await resumeWorkflow({
      step: stepId,
      runId: run.runId,
      resumeData,
      workflowId,
      requestContext,
    });
  };

  const handleCancelWorkflowRun = async () => {
    const response = await cancelWorkflowRun({ workflowId, runId: innerRunId });
    setCancelResponse(response);
  };

  const streamResultToUse = result ?? streamResult;

  const suspendedSteps = Object.entries(streamResultToUse?.steps || {})
    .filter(([_, { status }]) => status === 'suspended')
    .map(([stepId, { suspendPayload }]) => ({
      stepId,
      runId: innerRunId,
      suspendPayload,
      isLoading: false,
    }));

  useEffect(() => {
    if (paramsRunId && observeWorkflowStream) {
      observeWorkflowStream({ workflowId, runId: paramsRunId });
      setInnerRunId(paramsRunId);
      setContextRunId(paramsRunId);
    }
  }, [paramsRunId]);

  useEffect(() => {
    setIsRunning(isStreamingWorkflow);
  }, [isStreamingWorkflow]);

  useEffect(() => {
    if (streamResult) {
      setResult(streamResult);
    }
  }, [streamResult]);

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
  const zodStateSchema = stateSchema ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stateSchema))) : null;

  const zodSchemaToUse = zodStateSchema
    ? z.object({
        inputData: zodInputSchema,
        initialState: zodStateSchema.optional(),
      })
    : zodInputSchema;

  const workflowActivePaths = streamResultToUse?.steps ?? {};
  const hasWorkflowActivePaths = Object.values(workflowActivePaths).length > 0;

  const doneStatuses = ['success', 'failed', 'canceled', 'tripwire'];

  return (
    <div className="h-full pt-3 overflow-y-auto">
      <div className="space-y-4 px-5 pb-5 border-b border-border1">
        {isSuspendedSteps && isStreamingWorkflow && (
          <div className="py-2 px-5 flex items-center gap-2 bg-surface5 -mx-5 -mt-5 border-b border-border1">
            <Icon>
              <Loader2 className="animate-spin text-neutral6" />
            </Icon>
            <Txt>Resuming workflow</Txt>
          </div>
        )}

        {!isSuspendedSteps && canExecuteWorkflow && (
          <>
            {zodSchemaToUse ? (
              <WorkflowInputData
                schema={zodSchemaToUse}
                defaultValues={payload}
                isSubmitLoading={isStreamingWorkflow}
                submitButtonLabel="Run"
                onSubmit={data => {
                  setPayload(data);
                  handleExecuteWorkflow(data);
                }}
                withoutSubmit={!!paramsRunId}
              />
            ) : !!paramsRunId ? null : (
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

        {!isSuspendedSteps && !canExecuteWorkflow && (
          <Txt variant="ui-sm" className="text-neutral3 py-2">
            You don't have permission to execute workflows.
          </Txt>
        )}

        {!isStreamingWorkflow &&
          isSuspendedSteps &&
          suspendedSteps?.map(step => {
            const stepDefinition = workflow.allSteps[step.stepId];
            if (!stepDefinition || stepDefinition.isWorkflow) return null;

            const stepSchema = stepDefinition?.resumeSchema
              ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.resumeSchema)))
              : z.record(z.string(), z.any());
            return (
              <div className="flex flex-col px-4" key={step.stepId}>
                <Txt variant="ui-xs" className="text-neutral3">
                  {step.stepId}
                </Txt>
                {step.suspendPayload && (
                  <div data-testid="suspended-payload">
                    <CodeEditor
                      data={step.suspendPayload}
                      className="w-full overflow-x-auto p-2"
                      showCopyButton={false}
                    />
                  </div>
                )}
                <WorkflowInputData
                  schema={stepSchema}
                  isSubmitLoading={isStreamingWorkflow}
                  submitButtonLabel="Resume workflow"
                  onSubmit={data => {
                    const stepIds = step.stepId?.split('.');
                    handleResumeWorkflow({
                      stepId: stepIds,
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

        {result?.status === 'running' && (
          <Button
            variant="light"
            className="w-full"
            size="lg"
            onClick={handleCancelWorkflowRun}
            disabled={
              !!cancelResponse?.message ||
              isCancellingWorkflowRun ||
              (result?.status && doneStatuses.includes(result?.status))
            }
          >
            {isCancellingWorkflowRun ? (
              <Icon>
                <Loader2 className="animate-spin" />
              </Icon>
            ) : (
              <Icon>
                <StopCircle />
              </Icon>
            )}
            {cancelResponse?.message || 'Cancel Workflow Run'}
          </Button>
        )}

        {hasWorkflowActivePaths && (
          <>
            <hr className="border-border1 border my-5" />
            <div className="flex flex-col gap-2">
              <Txt variant="ui-xs" className="px-4 text-neutral3">
                Status
              </Txt>
              <div className="px-4 flex flex-col gap-4">
                {Object.entries(workflowActivePaths)
                  .filter(([key, _]) => key !== 'input' && !key.endsWith('.input'))
                  .map(([stepId, step]) => {
                    const { status } = step;
                    let output = undefined;
                    let suspendOutput = undefined;
                    let error = undefined;
                    if (step.status === 'suspended') {
                      suspendOutput = step.suspendOutput;
                    }
                    if (step.status === 'success') {
                      output = step.output;
                    }
                    if (step.status === 'failed') {
                      error = step.error;
                    }

                    // Build tripwire info from step or workflow-level result
                    // TripwireData is aligned with core schema: { reason, retry?, metadata?, processorId? }
                    const tripwireInfo =
                      step.status === 'failed' && step.tripwire
                        ? step.tripwire
                        : streamResultToUse?.status === 'tripwire'
                          ? {
                              reason: streamResultToUse?.tripwire?.reason,
                              retry: streamResultToUse?.tripwire?.retry,
                              metadata: streamResultToUse?.tripwire?.metadata,
                              processorId: streamResultToUse?.tripwire?.processorId,
                            }
                          : undefined;

                    // Show tripwire status for failed steps with tripwire info
                    const displayStatus = step.status === 'failed' && step.tripwire ? 'tripwire' : status;

                    return (
                      <WorkflowStatus
                        key={stepId}
                        stepId={stepId}
                        status={displayStatus}
                        result={output ?? suspendOutput ?? error ?? {}}
                        tripwire={tripwireInfo}
                      />
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      {result && !isObjectEmpty(result) && (
        <div className="p-5 border-b border-border1">
          <WorkflowJsonDialog result={result} />
        </div>
      )}
    </div>
  );
}

const WorkflowJsonDialog = ({ result }: { result: Record<string, unknown> }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="light" onClick={() => setOpen(true)} className="w-full" size="lg">
        <Icon>
          <Braces className="text-neutral3" />
        </Icon>
        Open Workflow Execution (JSON)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-surface2">
            <DialogTitle>Workflow Execution (JSON)</DialogTitle>
            <div className="w-full h-full overflow-x-scroll">
              <CodeEditor data={result} className="p-4" />
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};
