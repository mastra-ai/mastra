import { Braces, Loader2 } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { toast } from '@/lib/toast';

import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Skeleton } from '@/ds/components/Skeleton';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { CodeEditor } from '@/ds/components/CodeEditor';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@/ds/components/Dialog';
import { isObjectEmpty } from '@/lib/object';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowRunContext, WorkflowRunStreamResult } from '../context/workflow-run-context';
import { useSuspendedSteps, useWorkflowSchemas, type SuspendedStep } from './use-workflow-trigger';
import { WorkflowTriggerForm } from './workflow-trigger-form';
import { WorkflowSuspendedSteps, type ResumeStepParams } from './workflow-suspended-steps';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowStepsStatus } from './workflow-steps-status';

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
  const requestContext = useMergedRequestContext();

  const { result, setResult, payload, setPayload, setRunId: setContextRunId } = useContext(WorkflowRunContext);
  const { canExecute } = usePermissions();

  // Check if user can execute workflows
  const canExecuteWorkflow = canExecute('workflows');

  const [innerRunId, setInnerRunId] = useState<string>('');
  const [cancelResponse, setCancelResponse] = useState<{ message: string } | null>(null);

  const streamResultToUse = result ?? streamResult;
  const suspendedSteps = useSuspendedSteps(streamResultToUse, innerRunId);
  const { zodSchemaToUse, hasStateSchema } = useWorkflowSchemas(workflow);

  const handleExecuteWorkflow = async (data: any) => {
    try {
      if (!workflow) return;

      setCancelResponse(null);
      setResult(null);

      const run = await createWorkflowRun({ workflowId });

      setRunId?.(run.runId);
      setInnerRunId(run.runId);
      setContextRunId(run.runId);

      const { initialState, inputData: dataInputData } = data ?? {};
      const inputData = hasStateSchema ? dataInputData : data;

      streamWorkflow({ workflowId, runId: run.runId, inputData, initialState, requestContext });
    } catch (err) {
      toast.error('Error executing workflow');
    }
  };

  const handleResumeWorkflow = async (step: ResumeStepParams) => {
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

  useEffect(() => {
    if (paramsRunId && observeWorkflowStream) {
      observeWorkflowStream({ workflowId, runId: paramsRunId });
      setInnerRunId(paramsRunId);
      setContextRunId(paramsRunId);
    }
  }, [paramsRunId]);

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
  const workflowActivePaths = streamResultToUse?.steps ?? {};
  const hasWorkflowActivePaths = Object.values(workflowActivePaths).length > 0;

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
          <WorkflowTriggerForm
            zodSchema={zodSchemaToUse}
            defaultValues={payload}
            isStreaming={isStreamingWorkflow}
            onExecute={data => {
              setPayload(data);
              handleExecuteWorkflow(data);
            }}
            isViewingRun={!!paramsRunId}
            isProcessorWorkflow={workflow?.isProcessorWorkflow}
          />
        )}

        {!isSuspendedSteps && !canExecuteWorkflow && (
          <Txt variant="ui-sm" className="text-neutral3 py-2">
            You don't have permission to execute workflows.
          </Txt>
        )}

        <WorkflowSuspendedSteps
          suspendedSteps={suspendedSteps}
          workflow={workflow}
          isStreaming={isStreamingWorkflow}
          onResume={handleResumeWorkflow}
        />

        <WorkflowCancelButton
          status={result?.status}
          cancelMessage={cancelResponse?.message ?? null}
          isCancelling={isCancellingWorkflowRun}
          onCancel={handleCancelWorkflowRun}
        />

        {hasWorkflowActivePaths && (
          <WorkflowStepsStatus steps={workflowActivePaths} workflowResult={streamResultToUse} />
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
      <Button variant="light" onClick={() => setOpen(true)} className="w-full truncate">
        <Icon>
          <Braces className="text-neutral3" />
        </Icon>
        Open Workflow Execution (JSON)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Workflow Execution (JSON)</DialogTitle>
            <DialogDescription>JSON view of the workflow execution result</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[90vh]">
            <CodeEditor data={result} className="p-4" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
