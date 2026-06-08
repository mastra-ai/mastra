import type { GetWorkflowResponse } from '@mastra/client-js';
import {
  Button,
  CodeEditor,
  ScrollArea,
  Skeleton,
  Txt,
  Icon,
  isObjectEmpty,
  toast,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogBody,
  Switch,
} from '@mastra/playground-ui';
import { Braces, Loader2 } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { WorkflowRequestContextDialog } from '../components/workflow-request-context-dialog';
import { WorkflowRunOptionsDialog } from '../components/workflow-run-options-dialog';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowStepsStatus } from './workflow-steps-status';
import { WorkflowSuspendedSteps } from './workflow-suspended-steps';
import type { ResumeStepParams } from './workflow-suspended-steps';
import { WorkflowTriggerForm } from './workflow-trigger-form';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

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

function DebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);
  return (
    <label className="flex shrink-0 items-center gap-2 cursor-pointer">
      <Switch checked={debugMode} onCheckedChange={setDebugMode} aria-label="Toggle debug" />
      <Txt variant="ui-xs" className="text-neutral3 whitespace-nowrap">
        Toggle debug
      </Txt>
    </label>
  );
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

  const hasFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResultToUse?.status ?? '');

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

      void streamWorkflow({ workflowId, runId: run.runId, inputData, initialState, requestContext });
    } catch {
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
    // Only react to the run id from params changing; the stream/setters are stable for this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsRunId]);

  useEffect(() => {
    if (streamResult) {
      setResult(streamResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              void handleExecuteWorkflow(data);
            }}
            isViewingRun={!!paramsRunId}
            isReadOnly={!!paramsRunId || hasFinished}
            isProcessorWorkflow={workflow?.isProcessorWorkflow}
            heading={!paramsRunId && hasFinished ? 'Run input' : undefined}
            leftActions={!paramsRunId ? <DebugModeSwitch /> : undefined}
            submitActions={
              <>
                {workflow?.requestContextSchema && (
                  <WorkflowRequestContextDialog requestContextSchema={workflow.requestContextSchema} />
                )}
                <WorkflowRunOptionsDialog />
              </>
            }
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
      <Button type="button" variant="default" onClick={() => setOpen(true)} className="w-full">
        <Braces className="text-neutral3" />
        Workflow Execution
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
