import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext, useRef } from 'react';
import { WorkflowRequestContextDialog } from '../components/workflow-request-context-dialog';
import { WorkflowRunOptionsDialog } from '../components/workflow-run-options-dialog';
import type { WorkflowRunContextType } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { isWorkflowRunFinished } from '../utils';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowDebugStepControls } from './workflow-debug-step-controls';
import { WorkflowJsonDialog } from './workflow-json-dialog';
import { WorkflowRunError } from './workflow-run-error';
import { WorkflowTriggerForm } from './workflow-trigger-form';
import { InitialWorkflowHeader, RunWorkflowHeader } from './workflow-trigger-header';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

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

function DebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <Switch checked={debugMode} onCheckedChange={setDebugMode} aria-label="Debug" />
      <Txt variant="ui-xs" className="text-neutral3 whitespace-nowrap">
        Debug
      </Txt>
    </label>
  );
}

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
  } = useContext(WorkflowRunContext);
  const { canExecute } = usePermissions();
  const canExecuteWorkflow = canExecute('workflows');

  const [isStarting, setIsStarting] = useState(false);
  const pendingStart = useRef<AbortController | null>(null);
  const [cancelResponse, setCancelResponse] = useState<{ runId: string; message: string }>();
  const observedParamRunRef = useRef<string | null>(null);

  const activeRunId = paramsRunId || contextRunId;
  const currentCancellation = cancelResponse?.runId === activeRunId ? cancelResponse : undefined;
  const streamResultToUse = activeRunId ? result : null;
  const suspendedSteps = useSuspendedSteps(streamResultToUse, activeRunId);
  const { zodSchemaToUse, hasStateSchema } = useWorkflowSchemas(workflow);

  const hasFinished = isWorkflowRunFinished(streamResultToUse?.status);
  // Only per-step (debug) runs pause, so a paused run is steppable even where debugMode starts false.
  const isPausedDebug = streamResultToUse?.status === 'paused';

  useEffect(() => () => pendingStart.current?.abort(), []);

  const handleExecuteWorkflow = async (data: any) => {
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
    const pausedResult = result?.status === 'paused' ? result : undefined;
    try {
      const response = await cancelWorkflowRun({ workflowId, runId: activeRunId });
      setCancelResponse({ ...response, runId: activeRunId });
      // Paused runs have no active stream to publish cancellation.
      if (pausedResult) setResult({ ...pausedResult, status: 'canceled' });
    } catch {
      toast.error('Error cancelling workflow run');
    }
  };

  useEffect(() => {
    if (!paramsRunId || !observeWorkflowStream) return;

    const observedParamRunKey = `${workflowId}:${paramsRunId}`;
    if (observedParamRunRef.current !== observedParamRunKey) {
      observeWorkflowStream({ workflowId, runId: paramsRunId });
      observedParamRunRef.current = observedParamRunKey;
    }
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
  const runIsInProgress = isStarting || isStreamingWorkflow || isSuspendedSteps;
  const viewsExistingRun = !!paramsRunId || hasFinished || isPausedDebug;
  const showsCancelButton = streamResultToUse?.status === 'running' || isSuspendedSteps || isPausedDebug;

  const runStatus = streamResultToUse?.status ?? paramsRunStatus;
  const headingSlot = activeRunId ? (
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
    <div className="h-full overflow-y-auto pt-3">
      <div className={`border-border1/50 border-b`}>
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
              key={`${workflowId}:${activeRunId ?? 'new'}`}
              zodSchema={zodSchemaToUse}
              defaultValues={payload}
              isStreaming={runIsInProgress}
              onExecute={data => {
                setPayload(data);
                void handleExecuteWorkflow(data);
              }}
              isViewingRun={viewsExistingRun}
              isReadOnly={viewsExistingRun || isSuspendedSteps}
              disableSubmit={isSuspendedSteps}
              isProcessorWorkflow={workflow?.isProcessorWorkflow}
              collapsible={false}
              headingSlot={headingSlot}
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
          </>
        )}

        {!canExecuteWorkflow && (
          <Txt variant="ui-sm" className="text-neutral3 px-5 py-2">
            You don't have permission to execute workflows.
          </Txt>
        )}

        {hasFinished && streamResultToUse && (
          <div className="px-5 pb-4">
            <div className="flex flex-col gap-3">
              <WorkflowRunError result={streamResultToUse} workflowError={workflowError} />
              <WorkflowJsonDialog
                className="w-full justify-start"
                variant="ghost"
                size="sm"
                data={streamResultToUse}
                triggerLabel="Entire workflow execution (JSON)"
                title="Entire workflow execution (JSON)"
              />
              {'result' in streamResultToUse && streamResultToUse.result !== undefined && (
                <WorkflowJsonDialog
                  className="w-full justify-start"
                  variant="ghost"
                  size="sm"
                  data={{ result: streamResultToUse.result }}
                  triggerLabel="Run output"
                  title="Run output (JSON)"
                />
              )}
            </div>
          </div>
        )}

        {isPausedDebug && canExecuteWorkflow && (
          <div className="px-5 pt-3 pb-4">
            <WorkflowDebugStepControls
              isStreaming={isStreamingWorkflow}
              disabled={isCancellingWorkflowRun || !!currentCancellation}
            />
          </div>
        )}

        {showsCancelButton && (
          <div data-testid="workflow-cancel-action" className="px-5 pt-3 pb-4">
            <WorkflowCancelButton
              status={isSuspendedSteps ? 'suspended' : streamResultToUse?.status}
              cancelMessage={currentCancellation?.message ?? null}
              isCancelling={isCancellingWorkflowRun}
              onCancel={handleCancelWorkflowRun}
              disabled={isSuspendedSteps || !canExecuteWorkflow}
            />
          </div>
        )}
      </div>
    </div>
  );
}
