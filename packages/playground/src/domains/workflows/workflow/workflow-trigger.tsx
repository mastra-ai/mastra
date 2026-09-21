import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useOptionalRequestContext } from '@mastra/playground-ui/domains/request-context';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext, useRef } from 'react';
import { WorkflowRunOptions } from '../components/workflow-run-options';
import type { WorkflowRunContextType } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { isWorkflowRunFinished } from '../utils';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowDebugModeSwitch } from './workflow-debug-mode-switch';
import { WorkflowDebugStepControls } from './workflow-debug-step-controls';
import { WorkflowRunData } from './workflow-run-data';
import { WorkflowRunError } from './workflow-run-error';
import { RunWorkflowHeader } from './workflow-run-header';
import { WorkflowTriggerForm } from './workflow-trigger-form';
import type { WorkflowTriggerFormProps } from './workflow-trigger-form';
import { InitialWorkflowHeader } from './workflow-trigger-header';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export type WorkflowTriggerProps = Pick<
  WorkflowRunContextType,
  | 'workflowId'
  | 'workflow'
  | 'isLoading'
  | 'createWorkflowRun'
  | 'streamWorkflow'
  | 'resumeWorkflow'
  | 'isStreamingWorkflow'
  | 'isCancellingWorkflowRun'
  | 'cancelWorkflowRun'
> & {
  paramsRunId?: string;
  paramsRunStatus?: WorkflowRunStatus;
  observeWorkflowStream?: (params: { workflowId: string; runId: string }) => void;
};

export function WorkflowTrigger({
  workflowId,
  paramsRunId,
  paramsRunStatus,
  workflow,
  isLoading,
  createWorkflowRun,
  streamWorkflow,
  observeWorkflowStream,
  isStreamingWorkflow,
  isCancellingWorkflowRun,
  cancelWorkflowRun,
}: WorkflowTriggerProps) {
  const requestContext = useOptionalRequestContext();

  const {
    result,
    setResult,
    payload,
    setPayload,
    setRunId: setContextRunId,
    runId: contextRunId,
    runSnapshot,
    workflowError,
  } = useContext(WorkflowRunContext);
  const { canExecute } = usePermissions();
  const canExecuteWorkflow = canExecute('workflows');

  const [isStarting, setIsStarting] = useState(false);
  const pendingStart = useRef<AbortController | null>(null);
  const observedParamRun = useRef<string | null>(null);
  const [cancelResponse, setCancelResponse] = useState<{ runId: string; message: string }>();

  const activeRunId = paramsRunId || contextRunId;
  const currentCancellation = cancelResponse?.runId === activeRunId ? cancelResponse : undefined;
  const streamResultToUse = activeRunId ? result : null;
  const suspendedSteps = useSuspendedSteps(streamResultToUse, activeRunId);
  const { zodSchemaToUse, hasStateSchema } = useWorkflowSchemas(workflow);

  const hasFinished = isWorkflowRunFinished(streamResultToUse?.status);

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
    const resultWithoutStream = result?.status === 'paused' || result?.status === 'suspended' ? result : undefined;
    try {
      const response = await cancelWorkflowRun({ workflowId, runId: activeRunId });
      setCancelResponse({ ...response, runId: activeRunId });
      if (resultWithoutStream) setResult({ ...resultWithoutStream, status: 'canceled' });
    } catch {
      toast.error('Error cancelling workflow run');
    }
  };

  useEffect(() => {
    if (!paramsRunId || !observeWorkflowStream) return;
    // Observing twice releases the stream reader and resets the run back to its snapshot.
    const paramRun = `${workflowId}:${paramsRunId}`;
    if (observedParamRun.current === paramRun) return;
    observedParamRun.current = paramRun;
    observeWorkflowStream({ workflowId, runId: paramsRunId });
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
  const showsCancelButton = streamResultToUse?.status === 'running' || streamResultToUse?.status === 'suspended';

  const isViewingRun = !!activeRunId;
  const runStatus = streamResultToUse?.status ?? paramsRunStatus ?? (isStreamingWorkflow ? 'running' : 'pending');
  const cancelAction = (
    <WorkflowCancelButton
      status={streamResultToUse?.status}
      cancelMessage={currentCancellation?.message ?? null}
      isCancelling={isCancellingWorkflowRun}
      onCancel={handleCancelWorkflowRun}
      disabled={!canExecuteWorkflow}
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
          <WorkflowTriggerForm
            key={`${workflowId}:${activeRunId || 'new'}`}
            zodSchema={zodSchemaToUse}
            defaultValues={payload}
            isStreaming={isStarting || isStreamingWorkflow}
            onExecute={data => {
              setPayload(data);
              void handleExecuteWorkflow(data);
            }}
            isViewingRun={isViewingRun}
            isProcessorWorkflow={workflow?.isProcessorWorkflow}
            collapsible={false}
            headingSlot={headingSlot}
            leftActions={!paramsRunId ? <WorkflowDebugModeSwitch /> : undefined}
            submitButtonLabel={isStarting ? 'Starting…' : 'Run'}
            submitActions={<WorkflowRunOptions requestContextSchema={workflow?.requestContextSchema} />}
          />
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

        {showsCancelButton && (
          <div data-testid="workflow-cancel-action" className="flex justify-end px-5 pt-3 pb-4">
            {cancelAction}
          </div>
        )}
        {streamResultToUse && <WorkflowRunData key={activeRunId} input={payload} result={streamResultToUse} />}
      </div>
    </div>
  );
}
