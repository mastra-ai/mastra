import type { WorkflowRunState } from '@mastra/core/workflows';
import { toast } from '@mastra/playground-ui';
import { useCreateWorkflowRun, useCancelWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { convertWorkflowRunStateToStreamResult } from '../utils';
import { WorkflowRunContext } from './workflow-run-context';
import type { WorkflowRunContextType, WorkflowRunStreamResult } from './workflow-run-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useWorkflow, useWorkflowRun } from '@/hooks';

function getRunTimestamp(value: Date | string | number | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function useWorkflowStreamActions({
  debugMode,
  tracingOptions,
  setIsRunning,
}: {
  debugMode: boolean;
  tracingOptions?: Parameters<typeof useStreamWorkflow>[0]['tracingOptions'];
  setIsRunning: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
    timeTravelWorkflowStream,
  } = useStreamWorkflow({
    debugMode,
    tracingOptions,
    onError: error => toast.error(error.message),
  });

  const startStreamWorkflow = useCallback(
    (props: Parameters<WorkflowRunContextType['streamWorkflow']>[0]) => {
      setIsRunning(true);
      return streamWorkflow.mutateAsync(props);
    },
    [setIsRunning, streamWorkflow],
  );

  const startResumeWorkflow = useCallback(
    (props: Parameters<WorkflowRunContextType['resumeWorkflow']>[0]) => {
      setIsRunning(true);
      return resumeWorkflowStream.mutateAsync(props);
    },
    [resumeWorkflowStream, setIsRunning],
  );

  const startObserveWorkflowStream = useCallback(
    (props: Parameters<NonNullable<WorkflowRunContextType['observeWorkflowStream']>>[0]) => {
      setIsRunning(true);
      return observeWorkflowStream.mutate(props);
    },
    [observeWorkflowStream, setIsRunning],
  );

  const startTimeTravelWorkflowStream = useCallback(
    (props: Parameters<WorkflowRunContextType['timeTravelWorkflowStream']>[0]) => {
      setIsRunning(true);
      return timeTravelWorkflowStream.mutateAsync(props);
    },
    [setIsRunning, timeTravelWorkflowStream],
  );

  return {
    streamResult,
    isStreaming,
    closeStreamsAndReset,
    startStreamWorkflow,
    startResumeWorkflow,
    startObserveWorkflowStream,
    startTimeTravelWorkflowStream,
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
  const [result, setResult] = useState<WorkflowRunStreamResult | null>(() =>
    snapshot ? convertWorkflowRunStateToStreamResult(snapshot) : null,
  );
  const [payload, setPayload] = useState<any>(() => snapshot?.context?.input ?? null);
  const [runId, setRunId] = useState<string>(() => initialRunId ?? '');
  const routeRunIdRef = useRef(initialRunId ?? snapshot?.runId ?? '');
  const [isRunning, setIsRunning] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const refetchExecResultInterval = isRunning
    ? undefined
    : ['success', 'failed', 'canceled', 'bailed'].includes(result?.status ?? '')
      ? undefined
      : 5000;

  const { isLoading: isLoadingRunExecutionResult, data: runExecutionResult } = useWorkflowRun(
    workflowId,
    initialRunId ?? '',
    refetchExecResultInterval,
  );

  const runSnapshot = useMemo(() => {
    return runExecutionResult && initialRunId
      ? ({
          context: {
            input: runExecutionResult?.payload,
            ...runExecutionResult?.steps,
          },
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId: initialRunId,
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
          timestamp: getRunTimestamp(runExecutionResult?.updatedAt) ?? getRunTimestamp(runExecutionResult?.createdAt),
          value: runExecutionResult?.initialState,
        } as WorkflowRunState)
      : undefined;
  }, [runExecutionResult, initialRunId]);

  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  const { settings } = useTracingSettings();

  const createWorkflowRun = useCreateWorkflowRun();
  const cancelWorkflowRun = useCancelWorkflowRun();
  const {
    streamResult,
    isStreaming,
    closeStreamsAndReset,
    startStreamWorkflow,
    startResumeWorkflow,
    startObserveWorkflowStream,
    startTimeTravelWorkflowStream,
  } = useWorkflowStreamActions({
    debugMode,
    tracingOptions: settings?.tracingOptions,
    setIsRunning,
  });

  const clearData = useCallback(() => {
    setResult(null);
    setPayload(null);
  }, []);

  useEffect(() => {
    setIsRunning(false);
  }, [initialRunId]);

  useEffect(() => {
    if (runSnapshot?.runId) {
      routeRunIdRef.current = runSnapshot.runId;
      setResult(convertWorkflowRunStateToStreamResult(runSnapshot));
      if (runSnapshot.value && Object.keys(runSnapshot.value).length > 0) {
        setPayload({
          initialState: runSnapshot.value,
          inputData: runSnapshot.context?.input,
        });
      } else {
        setPayload(runSnapshot.context?.input);
      }
      setRunId(runSnapshot.runId);
      return;
    }

    if (!initialRunId && routeRunIdRef.current) {
      routeRunIdRef.current = '';
      setResult(null);
      setPayload(null);
      setRunId('');
      setIsRunning(false);
    }
  }, [initialRunId, runSnapshot]);

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
      streamResult,
      isStreamingWorkflow: isStreaming,
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
      payload,
      clearData,
      snapshot,
      runId,
      error,
      workflow,
      isLoading,
      createWorkflowRun.mutateAsync,
      startStreamWorkflow,
      startResumeWorkflow,
      streamResult,
      isStreaming,
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
