import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCreateWorkflowRun, useCancelWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  convertWorkflowRunStateToStreamResult,
  getRunTimestamp,
  isPersistedRunState,
  isWorkflowRunFinished,
} from '../utils';
import { WorkflowRunContext } from './workflow-run-context';
import type {
  ObserveWorkflowRunParams,
  TimeTravelWorkflowRunParams,
  WorkflowRunContextType,
  WorkflowRunSnapshot,
  WorkflowRunStreamResult,
} from './workflow-run-context';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useWorkflow, useWorkflowRun, workflowRunQueryKey } from '@/hooks';

type StreamMode = 'execute' | 'observe';
type StreamRun = { runId: string; mode: StreamMode };
type RunResultOverride = { runId: string; result: WorkflowRunStreamResult };
type LocalRun = { runId: string; payload: unknown; override: RunResultOverride | null };

const NO_LOCAL_RUN: LocalRun = { runId: '', payload: null, override: null };

const RUN_POLL_INTERVAL_MS = 5000;

const pollUntilRunFinished: Parameters<typeof useWorkflowRun>[2] = query =>
  isWorkflowRunFinished(query.state.data?.status) ? false : RUN_POLL_INTERVAL_MS;

function withRunTimestamp(run: GetWorkflowRunByIdResponse) {
  return { ...run, timestamp: getRunTimestamp(run.updatedAt) ?? getRunTimestamp(run.createdAt) };
}

// Object.fromEntries keeps a "__proto__" step id as an own key; index assignment would hit the setter.
function mergeStepResults(liveSteps: WorkflowRunStreamResult['steps'], storedSteps: WorkflowRunStreamResult['steps']) {
  const mergedLiveSteps = Object.entries(liveSteps).map(
    ([stepId, liveStep]) => [stepId, { ...storedSteps[stepId], ...liveStep }] as const,
  );
  return { ...storedSteps, ...Object.fromEntries(mergedLiveSteps) };
}

function resolveWorkflowRunResult(
  liveResult: WorkflowRunStreamResult | null,
  storedResult: WorkflowRunStreamResult | null,
) {
  if (!liveResult?.status) return storedResult ?? liveResult;
  if (!storedResult) return liveResult;
  return {
    ...liveResult,
    input: liveResult.input ?? storedResult.input,
    steps: mergeStepResults(liveResult.steps, storedResult.steps),
  };
}

function readInitialState(runSnapshot: WorkflowRunSnapshot) {
  return isPersistedRunState(runSnapshot) ? runSnapshot.value : runSnapshot.initialState;
}

function readStoredPayload(runSnapshot: WorkflowRunSnapshot, storedInput: WorkflowRunStreamResult['input']) {
  const initialState = readInitialState(runSnapshot);
  const hasInitialState = initialState && Object.keys(initialState).length > 0;
  return hasInitialState ? { initialState, inputData: storedInput } : storedInput;
}

function isIdleRunStatus(status: WorkflowRunStreamResult['status'] | undefined) {
  return status === 'paused' || status === 'suspended';
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
  const [localRun, setLocalRun] = useState(NO_LOCAL_RUN);
  const [streamRun, setStreamRun] = useState<StreamRun>();
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
    closeStreamsAndReset: closeStream,
    resumeWorkflowStream: { mutateAsync: resumeWorkflowStream },
    timeTravelWorkflowStream: { mutateAsync: timeTravelWorkflowStream },
  } = useStreamWorkflow({
    debugMode,
    tracingOptions: settings?.tracingOptions,
    onError: error => toast.error(error.message),
  });

  const runId = initialRunId ?? localRun.runId;
  const streamBelongsToRun = streamRun?.runId === runId;
  const selectedStream = streamBelongsToRun && streamResult.status ? streamResult : null;
  const isStreamOpen = streamBelongsToRun && isStreaming;
  const selectedOverride = localRun.override?.runId === runId ? localRun.override.result : null;
  const liveResult = selectedOverride ?? selectedStream;
  const localRunFinished = !initialRunId && isWorkflowRunFinished(liveResult?.status);
  const persistedRunId = initialRunId || (localRunFinished ? runId : '');
  const { data: persistedRunData, isLoading: isLoadingRunExecutionResult } = useWorkflowRun(
    workflowId,
    persistedRunId,
    isStreamOpen ? undefined : pollUntilRunFinished,
  );
  const persistedRun = useMemo(() => persistedRunData && withRunTimestamp(persistedRunData), [persistedRunData]);
  const storedSnapshot = persistedRun ?? snapshot;
  const storedResult = useMemo(
    () => (storedSnapshot ? convertWorkflowRunStateToStreamResult(storedSnapshot) : null),
    [storedSnapshot],
  );
  const result = useMemo(() => resolveWorkflowRunResult(liveResult, storedResult), [liveResult, storedResult]);
  const runSnapshot = initialRunId ? storedSnapshot : undefined;
  const observedRunIsIdle = streamRun?.mode === 'observe' && isIdleRunStatus(result?.status);
  const isStreamingWorkflow = isStreamOpen && !observedRunIsIdle;
  const payload = useMemo(
    () => (runSnapshot ? readStoredPayload(runSnapshot, storedResult?.input) : localRun.payload),
    [runSnapshot, storedResult, localRun.payload],
  );

  const setRunId = useCallback(
    (runId: string) => {
      closeStepDetail?.();
      setLocalRun(current => ({ ...current, runId }));
    },
    [closeStepDetail],
  );
  const setPayload = useCallback((payload: unknown) => setLocalRun(current => ({ ...current, payload })), []);
  const setResult = useCallback(
    (result: WorkflowRunStreamResult | null) =>
      setLocalRun(current => ({
        ...current,
        override: result && { runId: initialRunId ?? current.runId, result },
      })),
    [initialRunId],
  );

  const closeStreamsAndReset = useCallback(() => {
    closeStream();
    setStreamRun(undefined);
  }, [closeStream]);
  const clearData = useCallback(() => {
    closeStepDetail?.();
    closeStreamsAndReset();
    setLocalRun(NO_LOCAL_RUN);
  }, [closeStreamsAndReset, closeStepDetail]);

  // Cleanup on route change instead of a key remount, so the canvas stays mounted.
  useEffect(() => clearData, [workflowId, initialRunId, clearData]);

  const selectStreamRun = useCallback((runId: string, mode: StreamMode = 'execute') => {
    setStreamRun({ runId, mode });
    setLocalRun(current => (current.override?.runId === runId ? { ...current, override: null } : current));
  }, []);
  const refreshPersistedRun = useCallback(
    (workflowId: string, runId: string) =>
      queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(workflowId, runId), exact: true }),
    [queryClient],
  );

  const startStreamWorkflow: WorkflowRunContextType['streamWorkflow'] = useCallback(
    async params => {
      selectStreamRun(params.runId);
      await streamWorkflow(params);
    },
    [selectStreamRun, streamWorkflow],
  );
  const startResumeWorkflow: WorkflowRunContextType['resumeWorkflow'] = useCallback(
    async params => {
      selectStreamRun(params.runId);
      try {
        await resumeWorkflowStream(params);
      } finally {
        await refreshPersistedRun(params.workflowId, params.runId);
      }
    },
    [refreshPersistedRun, selectStreamRun, resumeWorkflowStream],
  );
  const startObserveWorkflowStream = useCallback(
    (params: ObserveWorkflowRunParams) => {
      if (params.storedStatus === 'suspended') {
        closeStreamsAndReset();
        return;
      }
      selectStreamRun(params.runId, 'observe');
      observeWorkflowStream({ workflowId: params.workflowId, runId: params.runId, storeRunResult: null });
    },
    [closeStreamsAndReset, selectStreamRun, observeWorkflowStream],
  );
  const startTimeTravelWorkflowStream = useCallback(
    async (params: TimeTravelWorkflowRunParams) => {
      selectStreamRun(params.runId);
      try {
        await timeTravelWorkflowStream(params);
      } finally {
        await refreshPersistedRun(params.workflowId, params.runId);
      }
    },
    [refreshPersistedRun, selectStreamRun, timeTravelWorkflowStream],
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
