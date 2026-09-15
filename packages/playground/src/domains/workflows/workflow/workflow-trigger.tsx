import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext, useRef } from 'react';
import { WorkflowRequestContextDialog } from '../components/workflow-request-context-dialog';
import { WorkflowRunOptionsDialog } from '../components/workflow-run-options-dialog';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowDebugModeSwitch } from './workflow-debug-mode-switch';
import { WorkflowDebugStepControls } from './workflow-debug-step-controls';
import { WorkflowRunData } from './workflow-run-data';
import { WorkflowRunError } from './workflow-run-error';
import { RunWorkflowHeader } from './workflow-run-header';
import { WorkflowTriggerForm } from './workflow-trigger-form';
import type { WorkflowTriggerFormProps } from './workflow-trigger-form';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

export interface WorkflowTriggerProps {
  workflowId: string;
  paramsRunId?: string;
  paramsRunStatus?: WorkflowRunStatus;
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

function InitialWorkflowHeader({ workflow, workflowId }: { workflow: GetWorkflowResponse; workflowId: string }) {
  const stepsCount = Object.keys(workflow.steps ?? {}).length;

  return (
    <div className="flex w-full items-center gap-2 px-5">
      <Icon className="text-neutral4 shrink-0">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="ui-md" className="text-neutral5 truncate font-semibold">
        {workflow.name ?? workflowId}
      </Txt>
      <CopyButton content={workflow.name ?? workflowId} variant="ghost" className="shrink-0" />
      <Badge className="ml-auto shrink-0">
        {stepsCount} step{stepsCount > 1 ? 's' : ''}
      </Badge>
    </div>
  );
}

export function WorkflowTrigger({
  workflowId,
  paramsRunId,
  paramsRunStatus,
  setRunId,
  workflow,
  isLoading,
  createWorkflowRun,
  streamWorkflow,
  observeWorkflowStream,
  isStreamingWorkflow,
  isCancellingWorkflowRun,
  cancelWorkflowRun,
}: WorkflowTriggerProps) {
  const requestContext = useMergedRequestContext();

  const {
    result,
    setResult,
    payload,
    setPayload,
    setRunId: setContextRunId,
    runId: contextRunId,
    runSnapshot,
    workflowError,
    debugMode,
  } = useContext(WorkflowRunContext);
  const { canExecute } = usePermissions();
  const canExecuteWorkflow = canExecute('workflows');

  const [isStarting, setIsStarting] = useState(false);
  const pendingStart = useRef<AbortController | null>(null);
  const [cancelResponse, setCancelResponse] = useState<{ runId: string; message: string }>();

  const activeRunId = paramsRunId || contextRunId;
  const currentCancellation = cancelResponse?.runId === activeRunId ? cancelResponse : undefined;
  const streamResultToUse = activeRunId ? result : null;
  const suspendedSteps = useSuspendedSteps(streamResultToUse, activeRunId ?? '');
  const { zodSchemaToUse, hasStateSchema } = useWorkflowSchemas(workflow);

  const hasFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResultToUse?.status ?? '');
  const isPausedDebug = streamResultToUse?.status === 'paused';

  useEffect(() => () => pendingStart.current?.abort(), []);

  const handleExecuteWorkflow = async (data: Parameters<WorkflowTriggerFormProps['onExecute']>[0]) => {
    if (!workflow || isStarting) return;
    pendingStart.current?.abort();
    const request = new AbortController();
    pendingStart.current = request;
    setIsStarting(true);
    try {
      setCancelResponse(undefined);
      setResult(null);

      const run = await createWorkflowRun({ workflowId });
      if (request.signal.aborted) return;

      setRunId?.(run.runId);
      setContextRunId(run.runId);
      setIsStarting(false);

      const { initialState, inputData: dataInputData } = data ?? {};
      const inputData = hasStateSchema ? dataInputData : data;

      await streamWorkflow({ workflowId, runId: run.runId, inputData, initialState, requestContext });
    } catch (error) {
      if (!request.signal.aborted) toast.error(error instanceof Error ? error.message : 'Error executing workflow');
    } finally {
      if (!request.signal.aborted) setIsStarting(false);
    }
  };

  const handleCancelWorkflowRun = async () => {
    if (!activeRunId) return;
    const pausedResult = result?.status === 'paused' ? result : undefined;
    try {
      const response = await cancelWorkflowRun({ workflowId, runId: activeRunId });
      setCancelResponse({ ...response, runId: activeRunId });
      // Paused runs have no active stream to publish cancellation.
      setResult(current => (current && current === pausedResult ? { ...current, status: 'canceled' } : current));
    } catch {
      toast.error('Error cancelling workflow run');
    }
  };

  useEffect(() => {
    if (paramsRunId) observeWorkflowStream?.({ workflowId, runId: paramsRunId });
  }, [paramsRunId, observeWorkflowStream, workflowId]);

  if (isLoading) {
    return (
      <ScrollArea className="text-ui-sm h-[calc(100vh-126px)] px-4 pt-2 pb-4">
        <div className="space-y-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </ScrollArea>
    );
  }

  if (!workflow) return null;

  const isSuspendedSteps = suspendedSteps.length > 0;

  const isViewingRun = !!activeRunId;
  const runButtonLabel = debugMode ? 'Start debug' : 'Run';
  const runStatus = streamResultToUse?.status ?? paramsRunStatus ?? (isStreamingWorkflow ? 'running' : 'pending');
  const cancelAction = (
    <WorkflowCancelButton
      status={isSuspendedSteps ? 'suspended' : streamResultToUse?.status}
      cancelMessage={currentCancellation?.message ?? null}
      isCancelling={isCancellingWorkflowRun}
      onCancel={handleCancelWorkflowRun}
      disabled={isSuspendedSteps || !canExecuteWorkflow}
    />
  );
  const headingSlot = isViewingRun ? (
    <RunWorkflowHeader
      runId={activeRunId}
      status={runStatus}
      result={streamResultToUse}
      timestamp={runSnapshot?.timestamp}
    />
  ) : (
    <InitialWorkflowHeader workflow={workflow} workflowId={workflowId} />
  );

  return (
    <div className="pt-3">
      <div>
        {isSuspendedSteps && isStreamingWorkflow && (
          <div className="bg-surface5 border-border1 -mt-5 flex items-center gap-2 border-b px-5 py-2">
            <Icon>
              <Loader2 className="text-neutral6 animate-spin" />
            </Icon>
            <Txt>Resuming workflow</Txt>
          </div>
        )}

        {canExecuteWorkflow && (
          <>
            <WorkflowTriggerForm
              zodSchema={zodSchemaToUse}
              defaultValues={payload}
              isStreaming={isStarting || isStreamingWorkflow || isSuspendedSteps}
              onExecute={data => {
                setPayload(data);
                void handleExecuteWorkflow(data);
              }}
              isViewingRun={isViewingRun}
              isReadOnly={isViewingRun}
              disableSubmit={isSuspendedSteps}
              isProcessorWorkflow={workflow?.isProcessorWorkflow}
              collapsible={false}
              headingSlot={headingSlot}
              leftActions={!paramsRunId ? <WorkflowDebugModeSwitch /> : undefined}
              submitButtonLabel={isStarting ? 'Starting…' : runButtonLabel}
              submitActions={
                <>
                  {workflow?.requestContextSchema && (
                    <WorkflowRequestContextDialog requestContextSchema={workflow.requestContextSchema} />
                  )}
                  <WorkflowRunOptionsDialog />
                </>
              }
            />
          </>
        )}

        {!canExecuteWorkflow && (
          <Txt variant="ui-sm" className="text-neutral3 px-5 py-2">
            You don't have permission to execute workflows.
          </Txt>
        )}

        {hasFinished && streamResultToUse && (
          <WorkflowRunError result={streamResultToUse} workflowError={workflowError} className="mx-5 mb-4" />
        )}

        {isPausedDebug && canExecuteWorkflow && (
          <div className="px-5 pt-3 pb-4">
            <WorkflowDebugStepControls
              isStreaming={isStreamingWorkflow}
              disabled={isCancellingWorkflowRun || !!currentCancellation}
            >
              {cancelAction}
            </WorkflowDebugStepControls>
          </div>
        )}

        {(streamResultToUse?.status === 'running' || isSuspendedSteps) && (
          <div data-testid="workflow-cancel-action" className="flex justify-end px-5 pt-3 pb-4">
            {cancelAction}
          </div>
        )}
        {streamResultToUse && <WorkflowRunData key={activeRunId} input={payload} result={streamResultToUse} />}
      </div>
    </div>
  );
}
