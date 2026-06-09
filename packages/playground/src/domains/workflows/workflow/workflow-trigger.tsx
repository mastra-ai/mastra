import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { ScrollArea, Skeleton, Txt, Icon, Badge, WorkflowIcon, toast, Switch, CopyButton } from '@mastra/playground-ui';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { WorkflowRequestContextDialog } from '../components/workflow-request-context-dialog';
import { WorkflowRunOptionsDialog } from '../components/workflow-run-options-dialog';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useSuspendedSteps, useWorkflowSchemas } from './use-workflow-trigger';
import { WorkflowCancelButton } from './workflow-cancel-button';
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

  const activeRunId = paramsRunId || innerRunId;
  const isViewingRun = !!activeRunId;
  const stepsCount = Object.keys(workflow?.steps ?? {}).length;
  const runStatus = streamResultToUse?.status ?? paramsRunStatus;

  const triggerHeadingSlot = (
    <div className="flex w-full items-center gap-2">
      <Icon className="shrink-0 text-neutral4">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="ui-md" className="text-neutral5 font-semibold truncate">
        {workflow?.name ?? workflowId}
      </Txt>
      <CopyButton content={workflow?.name ?? workflowId} variant="ghost" className="shrink-0" />
      <Badge className="ml-auto shrink-0">
        {stepsCount} step{stepsCount > 1 ? 's' : ''}
      </Badge>
    </div>
  );

  const runHeadingSlot = (
    <div className="flex w-full items-center gap-2">
      <Icon className="shrink-0 text-neutral4">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="ui-md" className="text-neutral5 font-semibold truncate" title={activeRunId}>
        {activeRunId}
      </Txt>
      {runStatus && (
        <span className="ml-auto shrink-0">
          <WorkflowRunStatusIcon status={runStatus} />
        </span>
      )}
    </div>
  );

  return (
    <div className="h-full pt-3 overflow-y-auto">
      <div className="space-y-4 border-b border-border1/50">
        {isSuspendedSteps && isStreamingWorkflow && (
          <div className="py-2 px-5 flex items-center gap-2 bg-surface5 -mt-5 border-b border-border1">
            <Icon>
              <Loader2 className="animate-spin text-neutral6" />
            </Icon>
            <Txt>Resuming workflow</Txt>
          </div>
        )}

        {canExecuteWorkflow && (
          <div className="px-5">
            <WorkflowTriggerForm
              zodSchema={zodSchemaToUse}
              defaultValues={payload}
              isStreaming={isStreamingWorkflow || isSuspendedSteps}
              onExecute={data => {
                setPayload(data);
                void handleExecuteWorkflow(data);
              }}
              isViewingRun={!!paramsRunId || hasFinished}
              isReadOnly={!!paramsRunId || hasFinished || isSuspendedSteps}
              disableSubmit={isSuspendedSteps}
              isProcessorWorkflow={workflow?.isProcessorWorkflow}
              collapsible={false}
              headingSlot={isViewingRun ? runHeadingSlot : triggerHeadingSlot}
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
          </div>
        )}

        {!canExecuteWorkflow && (
          <Txt variant="ui-sm" className="text-neutral3 py-2 px-5">
            You don't have permission to execute workflows.
          </Txt>
        )}

        {(result?.status === 'running' || isSuspendedSteps) && (
          <div className="px-5 pb-4 -mt-2">
            <WorkflowCancelButton
              status={isSuspendedSteps ? 'suspended' : result?.status}
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
