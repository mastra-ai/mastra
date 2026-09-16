import type { WorkflowRunState } from '@mastra/core/workflows';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCreateWorkflowRun, useCancelWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { convertWorkflowRunStateToStreamResult, getRunTimestamp, isWorkflowRunFinished } from '../utils';
import { WorkflowRunContext } from './workflow-run-context';
import type { WorkflowRunContextType, WorkflowRunStreamResult } from './workflow-run-context';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useWorkflow, useWorkflowRun } from '@/hooks';

function resolveWorkflowRunResult(
  liveResult: WorkflowRunStreamResult | null,
  storedResult: WorkflowRunStreamResult | null,
) {
  if (!liveResult?.status) return storedResult ?? liveResult;
  if (!storedResult) return liveResult;
  const steps = {
    ...storedResult.steps,
    ...Object.fromEntries(
      Object.entries(liveResult.steps).map(
        ([stepId, step]) => [stepId, { ...storedResult.steps[stepId], ...step }] as const,
      ),
    ),
  };
  return {
    ...liveResult,
    input: liveResult.input === undefined ? storedResult.input : liveResult.input,
    steps,
  };
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
  const closeStepDetail = useContext(WorkflowStepDetailContext)?.closeStepDetail;
  const [localRun, setLocalRun] = useState<{
    runId: string;
    result: WorkflowRunStreamResult | null;
    payload: unknown;
  }>({ runId: '', result: null, payload: null });
  const [streamRun, setStreamRun] = useState<{ runId?: string; mode: 'execute' | 'observe' }>();
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
  const selectedStream = streamRun?.runId === runId && streamResult.status ? streamResult : null;
  const selectedOverride = localRun.runId === runId ? localRun.result : null;
  const isStreamOpen = streamRun?.runId === runId && isStreaming;
  const liveResult = selectedOverride ?? selectedStream;
  const completedRunId = !initialRunId && isWorkflowRunFinished(liveResult?.status) ? runId : '';
  const snapshotRunId = initialRunId || completedRunId;
  const { isLoading: isLoadingRunExecutionResult, data: runExecutionResult } = useWorkflowRun(
    workflowId,
    snapshotRunId,
    isStreamOpen ? undefined : query => (isWorkflowRunFinished(query.state.data?.status) ? false : 5000),
  );

  const executionSnapshot = useMemo(() => {
    return runExecutionResult && snapshotRunId
      ? {
          ...runExecutionResult,
          timestamp: getRunTimestamp(runExecutionResult.updatedAt) ?? getRunTimestamp(runExecutionResult.createdAt),
        }
      : undefined;
  }, [runExecutionResult, snapshotRunId]);

  const runSnapshot = initialRunId ? (executionSnapshot ?? snapshot) : undefined;
  const storedResult = useMemo(() => {
    const storedSnapshot = executionSnapshot ?? snapshot;
    return storedSnapshot ? convertWorkflowRunStateToStreamResult(storedSnapshot) : null;
  }, [executionSnapshot, snapshot]);
  const result = useMemo(() => resolveWorkflowRunResult(liveResult, storedResult), [liveResult, storedResult]);
  const isObservingIdleRun =
    streamRun?.mode === 'observe' && (result?.status === 'paused' || result?.status === 'suspended');
  const isStreamingWorkflow = isStreamOpen && !isObservingIdleRun;
  const payload = useMemo(() => {
    if (!runSnapshot) return localRun.payload;
    const initialState = 'value' in runSnapshot ? runSnapshot.value : runSnapshot.initialState;
    if (initialState && Object.keys(initialState).length > 0) {
      return { initialState, inputData: storedResult?.input };
    }
    return storedResult?.input;
  }, [runSnapshot, storedResult, localRun.payload]);

  const setRunId: WorkflowRunContextType['setRunId'] = useCallback(
    update => {
      closeStepDetail?.();
      setLocalRun(current => {
        const runId = typeof update === 'function' ? update(current.runId) : update;
        return runId === current.runId ? current : { ...current, runId, result: null };
      });
    },
    [closeStepDetail],
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
    setStreamRun(undefined);
  }, [resetStream]);
  const clearData = useCallback(() => {
    closeStepDetail?.();
    closeStreamsAndReset();
    setLocalRun({ runId: '', result: null, payload: null });
  }, [closeStreamsAndReset, closeStepDetail]);

  // Keep the canvas mounted while releasing the previous route's stream and run state.
  useEffect(() => clearData, [workflowId, initialRunId, clearData]);

  const selectStreamRun = useCallback((runId?: string, mode: 'execute' | 'observe' = 'execute') => {
    setStreamRun({ runId, mode });
    setLocalRun(current => (current.runId === runId ? { ...current, result: null } : current));
  }, []);

  const startStreamWorkflow = useCallback(
    async (props: Parameters<WorkflowRunContextType['streamWorkflow']>[0]) => {
      selectStreamRun(props.runId);
      await streamWorkflow(props);
    },
    [selectStreamRun, streamWorkflow],
  );

  const startResumeWorkflow = useCallback(
    async (props: Parameters<WorkflowRunContextType['resumeWorkflow']>[0]) => {
      selectStreamRun(props.runId);
      try {
        await resumeWorkflowStream(props);
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['workflow-run', props.workflowId, props.runId], exact: true });
      }
    },
    [queryClient, selectStreamRun, resumeWorkflowStream],
  );

  const startObserveWorkflowStream = useCallback(
    (props: Parameters<NonNullable<WorkflowRunContextType['observeWorkflowStream']>>[0]) => {
      if (props.storedStatus === 'suspended') {
        closeStreamsAndReset();
        return;
      }
      selectStreamRun(props.runId, 'observe');
      observeWorkflowStream({ workflowId: props.workflowId, runId: props.runId, storeRunResult: null });
    },
    [closeStreamsAndReset, selectStreamRun, observeWorkflowStream],
  );

  const startTimeTravelWorkflowStream = useCallback(
    async (props: Parameters<WorkflowRunContextType['timeTravelWorkflowStream']>[0]) => {
      selectStreamRun(props.runId);
      try {
        await timeTravelWorkflowStream(props);
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['workflow-run', props.workflowId, props.runId], exact: true });
      }
    },
    [queryClient, selectStreamRun, timeTravelWorkflowStream],
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
