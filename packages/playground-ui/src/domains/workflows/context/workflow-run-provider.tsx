import type { WorkflowRunState } from '@mastra/core/workflows';
import { useCreateWorkflowRun, useCancelWorkflowRun } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useWorkflow } from '../hooks/use-workflow';
import { workflowRunQueryKey } from '../hooks/use-workflow-runs';
import {
  convertWorkflowRunStateToStreamResult,
  isIdleRunStatus,
  isWorkflowRunFinished,
  readStoredPayload,
  resolveWorkflowRunResult,
} from '../utils';
import { useLocalRun } from './use-local-run';
import { usePersistedWorkflowRun } from './use-persisted-workflow-run';
import { useStreamForRun } from './use-stream-for-run';
import type { StreamMode } from './use-stream-for-run';
import { WorkflowRunContext } from './workflow-run-context';
import type {
  ObserveWorkflowRunParams,
  TimeTravelWorkflowRunParams,
  WorkflowRunContextType,
} from './workflow-run-context';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';

const EMPTY_REQUEST_CONTEXT: Record<string, any> = {};

export function WorkflowRunProvider({
  children,
  snapshot,
  workflowId,
  initialRunId,
  withoutTimeTravel = false,
  requestContext = EMPTY_REQUEST_CONTEXT,
}: {
  children: ReactNode;
  snapshot?: WorkflowRunState;
  workflowId: string;
  initialRunId?: string;
  withoutTimeTravel?: boolean;
  requestContext?: Record<string, any>;
}) {
  const resetStepDetail = useContext(WorkflowStepDetailContext)?.resetStepDetail;
  const [debugMode, setDebugMode] = useState(false);
  const { data: workflow, isLoading, error } = useWorkflow(workflowId, requestContext);
  const { settings } = useTracingSettings();
  const queryClient = useQueryClient();
  const createWorkflowRun = useCreateWorkflowRun();
  const cancelWorkflowRun = useCancelWorkflowRun();
  const {
    runId,
    payload: localPayload,
    override,
    setRunId: selectLocalRun,
    setPayload,
    setResult,
    dropOverride,
    reset: resetLocalRun,
  } = useLocalRun(initialRunId);
  const {
    result: streamedResult,
    isOpen: isStreamOpen,
    isObserving,
    select: selectStream,
    close: closeStreamsAndReset,
    streamWorkflow,
    resumeWorkflowStream,
    observeWorkflowStream,
    timeTravelWorkflowStream,
  } = useStreamForRun({ runId, debugMode, tracingOptions: settings?.tracingOptions });

  const liveResult = override ?? streamedResult;
  const localRunFinished = !initialRunId && isWorkflowRunFinished(liveResult?.status);
  const persistedRunId = initialRunId || (localRunFinished ? runId : '');
  const { persistedRun, isLoading: isLoadingRunExecutionResult } = usePersistedWorkflowRun(workflowId, persistedRunId, {
    poll: !isStreamOpen,
  });
  const storedSnapshot = persistedRun ?? snapshot;
  const storedResult = useMemo(
    () => (storedSnapshot ? convertWorkflowRunStateToStreamResult(storedSnapshot) : null),
    [storedSnapshot],
  );
  const result = useMemo(() => resolveWorkflowRunResult(liveResult, storedResult), [liveResult, storedResult]);
  const runSnapshot = initialRunId ? storedSnapshot : undefined;
  const observedRunIsIdle = isObserving && isIdleRunStatus(result?.status);
  const isStreamingWorkflow = isStreamOpen && !observedRunIsIdle;
  const payload = useMemo(
    () => (runSnapshot ? readStoredPayload(runSnapshot, storedResult?.input) : localPayload),
    [runSnapshot, storedResult, localPayload],
  );

  const setRunId = useCallback(
    (runId: string) => {
      resetStepDetail?.();
      selectLocalRun(runId);
    },
    [resetStepDetail, selectLocalRun],
  );
  const clearData = useCallback(() => {
    resetStepDetail?.();
    closeStreamsAndReset();
    resetLocalRun();
  }, [resetStepDetail, closeStreamsAndReset, resetLocalRun]);

  // Cleanup on route change instead of a key remount, so the canvas stays mounted.
  useEffect(() => clearData, [workflowId, initialRunId, clearData]);

  const selectStreamRun = useCallback(
    (runId: string, mode?: StreamMode) => {
      selectStream(runId, mode);
      dropOverride(runId);
    },
    [selectStream, dropOverride],
  );
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
      workflow: workflow ?? undefined,
      workflowError: error ?? null,
      isLoading,
      runId,
      setRunId,
      result,
      setResult,
      streamResult: streamedResult,
      payload,
      setPayload,
      clearData,
      snapshot,
      runSnapshot,
      isLoadingRunExecutionResult,
      isStreamingWorkflow,
      isCancellingWorkflowRun: cancelWorkflowRun.isPending,
      createWorkflowRun: createWorkflowRun.mutateAsync,
      streamWorkflow: startStreamWorkflow,
      resumeWorkflow: startResumeWorkflow,
      observeWorkflowStream: startObserveWorkflowStream,
      timeTravelWorkflowStream: startTimeTravelWorkflowStream,
      cancelWorkflowRun: cancelWorkflowRun.mutateAsync,
      closeStreamsAndReset,
      withoutTimeTravel,
      debugMode,
      setDebugMode,
    }),
    [
      workflowId,
      workflow,
      error,
      isLoading,
      runId,
      setRunId,
      result,
      setResult,
      streamedResult,
      payload,
      setPayload,
      clearData,
      snapshot,
      runSnapshot,
      isLoadingRunExecutionResult,
      isStreamingWorkflow,
      cancelWorkflowRun.isPending,
      createWorkflowRun.mutateAsync,
      startStreamWorkflow,
      startResumeWorkflow,
      startObserveWorkflowStream,
      startTimeTravelWorkflowStream,
      cancelWorkflowRun.mutateAsync,
      closeStreamsAndReset,
      withoutTimeTravel,
      debugMode,
    ],
  );

  return <WorkflowRunContext.Provider value={value}>{children}</WorkflowRunContext.Provider>;
}
