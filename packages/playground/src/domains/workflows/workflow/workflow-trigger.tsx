import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext, useRef } from 'react';
import { WorkflowRequestContextDialog } from '../components/workflow-request-context-dialog';
import { WorkflowRunOptionsDialog } from '../components/workflow-run-options-dialog';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
import { WorkflowDebugStepControls } from './workflow-debug-step-controls';
import { WorkflowJsonDialog } from './workflow-json-dialog';
import { WorkflowTriggerForm } from './workflow-trigger-form';
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

function useSyncStreamResultToWorkflowRunContext(streamResult: WorkflowRunStreamResult | null) {
  const { setResult } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (streamResult) {
      setResult(streamResult);
    }
  }, [setResult, streamResult]);
}

function formatRunStatus(status?: WorkflowRunStatus) {
  if (!status) return 'Run';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRunDuration(durationMs?: number) {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;

  const seconds = durationMs / 1000;
  if (seconds < 60) return `${Number(seconds.toPrecision(3))}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatRelativeTime(ms?: number) {
  if (!ms || ms <= 0) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  if (seconds < 60) return diff >= 0 ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
}

function getRunDuration(result: WorkflowRunStreamResult | null, status?: WorkflowRunStatus) {
  const stepTimes: Array<{ startedAt: number; endedAt?: number }> = Object.values(result?.steps ?? {}).flatMap(step => {
    const startedAt = 'startedAt' in step ? step.startedAt : undefined;
    if (typeof startedAt !== 'number') return [];
    const endedAt = 'endedAt' in step ? step.endedAt : undefined;
    return [{ startedAt, ...(typeof endedAt === 'number' ? { endedAt } : {}) }];
  });

  if (stepTimes.length === 0) return undefined;

  const startedAt = Math.min(...stepTimes.map(step => step.startedAt));
  const endedTimes = stepTimes.flatMap(step => (step.endedAt ? [step.endedAt] : []));
  const endedAt = endedTimes.length > 0 ? Math.max(...endedTimes) : undefined;
  const isActive = status === 'running' || status === 'suspended' || status === 'waiting';
  const effectiveEndedAt = endedAt ?? (isActive ? Date.now() : undefined);
  return effectiveEndedAt === undefined ? undefined : effectiveEndedAt - startedAt;
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

function RunWorkflowHeader({
  runId,
  status,
  result,
  timestamp,
}: {
  runId: string;
  status?: WorkflowRunStatus;
  result: WorkflowRunStreamResult | null;
  timestamp?: number;
}) {
  const runDuration = getRunDuration(result, status);

  return (
    <div className="flex w-full items-start gap-3 px-5">
      {status && (
        <span className="shrink-0 pt-1">
          <WorkflowRunStatusIcon status={status} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Txt as="span" variant="ui-md" className="text-neutral5 block truncate font-semibold">
          {formatRunStatus(status)}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-neutral3 block truncate" title={runId}>
          {runId}
        </Txt>
      </div>
      <div className="shrink-0 text-right">
        <Txt as="span" variant="ui-xs" className="text-neutral5 block font-medium">
          {formatRunDuration(runDuration)}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-neutral3 block">
          {formatRelativeTime(timestamp)}
        </Txt>
      </div>
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
  streamResult,
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
  } = useContext(WorkflowRunContext);
  useSyncStreamResultToWorkflowRunContext(streamResult);
  const { canExecute } = usePermissions();

  // Check if user can execute workflows
  const canExecuteWorkflow = canExecute('workflows');

  const [innerRunId, setInnerRunId] = useState<string>('');
  const [cancelResponse, setCancelResponse] = useState<{ message: string } | null>(null);
  const observedParamRunRef = useRef<string | null>(null);

  const activeRunId = paramsRunId || contextRunId;
  const streamResultToUse = activeRunId ? (result ?? streamResult) : null;
  const suspendedSteps = useSuspendedSteps(streamResultToUse, innerRunId);
  const { zodSchemaToUse, hasStateSchema } = useWorkflowSchemas(workflow);

  const hasFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResultToUse?.status ?? '');
  // A run only reaches the 'paused' status when it was started in per-step (debug) mode, so a
  // paused run always exposes the step controls — including when viewing a paused run directly
  // on its :runId page, where the in-memory debugMode flag starts out false.
  const isPausedDebug = streamResultToUse?.status === 'paused';

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

  const handleCancelWorkflowRun = async () => {
    try {
      const response = await cancelWorkflowRun({ workflowId, runId: innerRunId });
      setCancelResponse(response);
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

    setInnerRunId(paramsRunId);
    setContextRunId(paramsRunId);
  }, [paramsRunId, observeWorkflowStream, setContextRunId, workflowId]);

  useEffect(() => {
    if (!paramsRunId && !contextRunId) {
      setInnerRunId('');
    }
  }, [contextRunId, paramsRunId]);

  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] px-4 pt-2 pb-4 text-xs">
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
  const runStatus = streamResultToUse?.status ?? paramsRunStatus;
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
              zodSchema={zodSchemaToUse}
              defaultValues={payload}
              isStreaming={isStreamingWorkflow || isSuspendedSteps}
              onExecute={data => {
                setPayload(data);
                void handleExecuteWorkflow(data);
              }}
              isViewingRun={!!paramsRunId || hasFinished || isPausedDebug}
              isReadOnly={!!paramsRunId || hasFinished || isSuspendedSteps || isPausedDebug}
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

        {hasFinished && result && (
          <div className="px-5 pb-4">
            <div className="flex flex-col gap-1">
              <WorkflowJsonDialog
                className="w-full justify-start"
                variant="ghost"
                size="sm"
                data={result}
                triggerLabel="Entire workflow execution (JSON)"
                title="Entire workflow execution (JSON)"
              />
              {'result' in result && result.result !== undefined && (
                <WorkflowJsonDialog
                  className="w-full justify-start"
                  variant="ghost"
                  size="sm"
                  data={{ result: result.result }}
                  triggerLabel="Run output"
                  title="Run output (JSON)"
                />
              )}
            </div>
          </div>
        )}

        {isPausedDebug && (
          <div className="px-5 pt-3 pb-4">
            <WorkflowDebugStepControls isStreaming={isStreamingWorkflow} />
          </div>
        )}

        {(streamResultToUse?.status === 'running' || isSuspendedSteps || isPausedDebug) && (
          <div data-testid="workflow-cancel-action" className="px-5 pt-3 pb-4">
            <WorkflowCancelButton
              status={isSuspendedSteps ? 'suspended' : streamResultToUse?.status}
              cancelMessage={cancelResponse?.message ?? null}
              isCancelling={isCancellingWorkflowRun}
              onCancel={handleCancelWorkflowRun}
              disabled={isSuspendedSteps}
            />
          </div>
        )}
      </div>
    </div>
  );
}
