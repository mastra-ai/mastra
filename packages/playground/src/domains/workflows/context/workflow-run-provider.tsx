import type { WorkflowRunState } from '@mastra/core/workflows';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCreateWorkflowRun, useCancelWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { convertWorkflowRunStateToStreamResult, isWorkflowRunFinished } from '../utils';
import { WorkflowRunContext } from './workflow-run-context';
import type { WorkflowRunContextType, WorkflowRunStreamResult } from './workflow-run-context';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useWorkflow, useWorkflowRun } from '@/hooks';

function getRunTimestamp(value: Date | string | number | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function resolveWorkflowRunResult(
  liveResult: WorkflowRunStreamResult | null,
  storedResult: WorkflowRunStreamResult | null,
  isStreaming: boolean,
) {
  if (!liveResult) return storedResult;
  const canReconcile =
    !isStreaming && storedResult?.status === liveResult.status && isWorkflowRunFinished(liveResult.status);
  if (!canReconcile) return liveResult;
  return { ...storedResult, ...liveResult, steps: { ...liveResult.steps, ...storedResult?.steps } };
}

export function WorkflowRunProvider({
  children,
  snapshot,
  workflowId,
  initialRunId,
  withoutTimeTravel = false,
}: {
  children: ReactNode;
  snapshot?: WorkflowRunState;
  workflowId: string;
  initialRunId?: string;
  withoutTimeTravel?: boolean;
}) {
  const resetStepDetail = useContext(WorkflowStepDetailContext)?.resetStepDetail;
  const [localRun, setLocalRun] = useState<{
    runId: string;
    result: WorkflowRunStreamResult | null;
    payload: unknown;
  }>({ runId: '', result: null, payload: null });
  const [streamRunId, setStreamRunId] = useState<string>();
  const [debugMode, setDebugMode] = useState(false);
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  const { settings } = useTracingSettings();
  const queryClient = useQueryClient();
  const createWorkflowRun = useCreateWorkflowRun();
  const cancelWorkflowRun = useCancelWorkflowRun();
  const {
    streamWorkflow: { mutateAsync: streamWorkflow },
    streamResult,
    isStreaming,
    observeWorkflowStream: { mutate: observeWorkflowStream },
    closeStreamsAndReset: resetStream,
    resumeWorkflowStream: { mutateAsync: resumeWorkflowStream },
    timeTravelWorkflowStream: { mutateAsync: timeTravelWorkflowStream },
  } = useStreamWorkflow({
    debugMode,
    tracingOptions: settings?.tracingOptions,
    onError: error => toast.error(error.message),
  });

  const runId = initialRunId ?? localRun.runId;
  const selectedStream = streamRunId === runId && streamResult.status ? streamResult : null;
  const selectedOverride = localRun.runId === runId ? localRun.result : null;
  const isStreamingWorkflow = streamRunId === runId && isStreaming;
  const liveResult = selectedOverride ?? selectedStream;
  const completedRunId = !initialRunId && isWorkflowRunFinished(liveResult?.status) ? runId : '';
  const snapshotRunId = initialRunId || completedRunId;
  const { isLoading: isLoadingRunExecutionResult, data: runExecutionResult } = useWorkflowRun(
    workflowId,
    snapshotRunId,
    isStreamingWorkflow ? undefined : query => (isWorkflowRunFinished(query.state.data?.status) ? false : 5000),
  );

  const executionSnapshot = useMemo(() => {
    return runExecutionResult && snapshotRunId
      ? ({
          context: {
            input: runExecutionResult?.payload,
            ...runExecutionResult?.steps,
          },
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId: snapshotRunId,
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
          timestamp: getRunTimestamp(runExecutionResult?.updatedAt) ?? getRunTimestamp(runExecutionResult?.createdAt),
          value: runExecutionResult?.initialState,
        } as WorkflowRunState)
      : undefined;
  }, [runExecutionResult, snapshotRunId]);

  const runSnapshot = initialRunId ? (executionSnapshot ?? snapshot) : undefined;
  const storedResult = useMemo(() => {
    const storedSnapshot = executionSnapshot ?? snapshot;
    return storedSnapshot ? convertWorkflowRunStateToStreamResult(storedSnapshot) : null;
  }, [executionSnapshot, snapshot]);
  const result = useMemo(
    () => resolveWorkflowRunResult(liveResult, storedResult, isStreamingWorkflow),
    [liveResult, storedResult, isStreamingWorkflow],
  );
  const payload = useMemo(() => {
    if (!runSnapshot) return localRun.payload;
    if (runSnapshot.value && Object.keys(runSnapshot.value).length > 0) {
      return { initialState: runSnapshot.value, inputData: runSnapshot.context?.input };
    }
    return runSnapshot.context?.input;
  }, [runSnapshot, localRun.payload]);

  const setRunId: WorkflowRunContextType['setRunId'] = useCallback(
    update => {
      resetStepDetail?.();
      setLocalRun(current => {
        const runId = typeof update === 'function' ? update(current.runId) : update;
        return runId === current.runId ? current : { ...current, runId, result: null };
      });
    },
    [resetStepDetail],
  );
  const setPayload: WorkflowRunContextType['setPayload'] = useCallback(payload => {
    setLocalRun(current => ({
      ...current,
      payload: typeof payload === 'function' ? payload(current.payload) : payload,
    }));
  }, []);
  const setResult: WorkflowRunContextType['setResult'] = useCallback(
    update => {
      setLocalRun(current => {
        const selectedRunId = initialRunId ?? current.runId;
        const currentOverride = current.runId === selectedRunId ? current.result : null;
        const currentResult = currentOverride ?? selectedStream ?? storedResult;
        return {
          ...current,
          runId: selectedRunId,
          result: typeof update === 'function' ? update(currentResult) : update,
        };
      });
    },
    [initialRunId, selectedStream, storedResult],
  );

  const closeStreamsAndReset = useCallback(() => {
    resetStream();
    setStreamRunId(undefined);
  }, [resetStream]);
  const clearData = useCallback(() => {
    resetStepDetail?.();
    closeStreamsAndReset();
    setLocalRun({ runId: '', result: null, payload: null });
  }, [closeStreamsAndReset, resetStepDetail]);

  useEffect(() => clearData, [initialRunId, clearData]);

  const startStreamWorkflow = useCallback(
    async (props: Parameters<WorkflowRunContextType['streamWorkflow']>[0]) => {
      closeStreamsAndReset();
      setStreamRunId(props.runId);
      await streamWorkflow(props);
    },
    [closeStreamsAndReset, streamWorkflow],
  );

  const startResumeWorkflow = useCallback(
    async (props: Parameters<WorkflowRunContextType['resumeWorkflow']>[0]) => {
      setStreamRunId(props.runId);
      try {
        await resumeWorkflowStream(props);
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['workflow-run', props.workflowId, props.runId], exact: true });
      }
    },
    [queryClient, resumeWorkflowStream],
  );

  const startObserveWorkflowStream = useCallback(
    (props: Parameters<NonNullable<WorkflowRunContextType['observeWorkflowStream']>>[0]) => {
      setStreamRunId(props.runId);
      observeWorkflowStream(props);
    },
    [observeWorkflowStream],
  );

  const startTimeTravelWorkflowStream = useCallback(
    async (props: Parameters<WorkflowRunContextType['timeTravelWorkflowStream']>[0]) => {
      setStreamRunId(props.runId);
      try {
        await timeTravelWorkflowStream(props);
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['workflow-run', props.workflowId, props.runId], exact: true });
      }
    },
    [queryClient, timeTravelWorkflowStream],
  );

  const value = useMemo<WorkflowRunContextType>(
    () => ({
      workflowId,
      result,
      setResult,
      payload,
      setPayload,
      clearData,
      snapshot,
      runId,
      setRunId,
      workflowError: error ?? null,
      workflow: workflow ?? undefined,
      isLoading,
      createWorkflowRun: createWorkflowRun.mutateAsync,
      streamWorkflow: startStreamWorkflow,
      resumeWorkflow: startResumeWorkflow,
      streamResult: selectedStream,
      isStreamingWorkflow,
      isCancellingWorkflowRun: cancelWorkflowRun.isPending,
      cancelWorkflowRun: cancelWorkflowRun.mutateAsync,
      observeWorkflowStream: startObserveWorkflowStream,
      closeStreamsAndReset,
      timeTravelWorkflowStream: startTimeTravelWorkflowStream,
      runSnapshot,
      isLoadingRunExecutionResult,
      withoutTimeTravel,
      debugMode,
      setDebugMode,
    }),
    [
      workflowId,
      result,
      setResult,
      payload,
      setPayload,
      clearData,
      snapshot,
      runId,
      setRunId,
      error,
      workflow,
      isLoading,
      createWorkflowRun.mutateAsync,
      startStreamWorkflow,
      startResumeWorkflow,
      selectedStream,
      isStreamingWorkflow,
      cancelWorkflowRun.isPending,
      cancelWorkflowRun.mutateAsync,
      startObserveWorkflowStream,
      closeStreamsAndReset,
      startTimeTravelWorkflowStream,
      runSnapshot,
      isLoadingRunExecutionResult,
      withoutTimeTravel,
      debugMode,
    ],
  );

  return <WorkflowRunContext.Provider value={value}>{children}</WorkflowRunContext.Provider>;
}
