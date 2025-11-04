import jsonSchemaToZod from 'json-schema-to-zod';
import { Braces, Loader2, StopCircle } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { Button } from '@/ds/components/Button';
import { CodeBlockDemo } from '@/components/ui/code-block';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { WorkflowRunContext, WorkflowRunStreamResult } from '../context/workflow-run-context';
import { toast } from 'sonner';
import { usePlaygroundStore } from '@/store/playground-store';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';

import { GetWorkflowResponse } from '@mastra/client-js';
import { SyntaxHighlighter } from '@/components/ui/syntax-highlighter';
import { Dialog, DialogPortal, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { WorkflowStatus } from './workflow-status';
import { WorkflowInputData } from './workflow-input-data';
import { isObjectEmpty } from '@/lib/object';

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
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    inputData: Record<string, unknown>;
    requestContext: Record<string, unknown>;
  }) => Promise<void>;
  observeWorkflowStream?: ({ workflowId, runId }: { workflowId: string; runId: string }) => void;
  resumeWorkflow: ({
    workflowId,
    step,
    runId,
    resumeData,
    requestContext,
  }: {
    workflowId: string;
    step: string | string[];
    runId: string;
    resumeData: Record<string, unknown>;
    requestContext: Record<string, unknown>;
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

  const [isRunning, setIsRunning] = useState(false);
  const [innerRunId, setInnerRunId] = useState<string>('');
  const [cancelResponse, setCancelResponse] = useState<{ message: string } | null>(null);
  const triggerSchema = workflow?.inputSchema;

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!workflow) return;
      setIsRunning(true);

      setCancelResponse(null);

      setResult(null);

      const { runId } = await createWorkflowRun({ workflowId });

      setRunId?.(runId);
      setInnerRunId(runId);
      setContextRunId(runId);

      streamWorkflow({ workflowId, runId, inputData: data, requestContext });
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

    const { runId } = await createWorkflowRun({ workflowId, prevRunId });

    await resumeWorkflow({
      step: stepId,
      runId,
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
    .map(([stepId, { payload }]) => ({
      stepId,
      runId: innerRunId,
      suspendPayload: payload,
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

  const workflowActivePaths = streamResultToUse?.steps ?? {};
  const hasWorkflowActivePaths = Object.values(workflowActivePaths).length > 0;

  const doneStatuses = ['success', 'failed', 'canceled'];

  return (
    <div className="h-full pt-3 pb-12">
      <div className="space-y-4 px-5 pb-5 border-b-sm border-border1">
        {isSuspendedSteps && isStreamingWorkflow && (
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
              <WorkflowInputData
                schema={zodInputSchema}
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
                <Text variant="secondary" className="text-mastra-el-3" size="xs">
                  {step.stepId}
                </Text>
                {step.suspendPayload && (
                  <div data-testid="suspended-payload">
                    <CodeBlockDemo
                      className="w-full overflow-x-auto p-2"
                      code={JSON.stringify(step.suspendPayload, null, 2)}
                      language="json"
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
            <hr className="border-border1 border-sm my-5" />
            <div className="flex flex-col gap-2">
              <Text variant="secondary" className="px-4 text-mastra-el-3" size="xs">
                Status
              </Text>
              <div className="px-4 flex flex-col gap-4">
                {Object.entries(workflowActivePaths)
                  .filter(([key, _]) => key !== 'input' && !key.endsWith('.input'))
                  .map(([stepId, step]) => {
                    const { status } = step;
                    let output = {};
                    if (step.status === 'success') {
                      output = step.output;
                    }
                    return <WorkflowStatus key={stepId} stepId={stepId} status={status} result={output} />;
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      {result && !isObjectEmpty(result) && (
        <div className="p-5 border-b-sm border-border1">
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
