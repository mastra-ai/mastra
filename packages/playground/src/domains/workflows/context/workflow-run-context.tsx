import type { TimeTravelParams } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { toast } from '@mastra/playground-ui';
import { useCreateWorkflowRun, useCancelWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import { convertWorkflowRunStateToStreamResult } from '../utils';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { WorkflowStepDetailProvider } from './workflow-step-detail-context';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useWorkflow, useWorkflowRun } from '@/hooks';

export type WorkflowRunStreamResult = WorkflowStreamResult<any, any, any, any>;

type WorkflowRunContextType = {
  result: WorkflowRunStreamResult | null;
  setResult: Dispatch<SetStateAction<WorkflowRunStreamResult | null>>;
  payload: any;
  setPayload: Dispatch<SetStateAction<any>>;
  clearData: () => void;
  snapshot?: WorkflowRunState;
  runId?: string;
  setRunId: Dispatch<SetStateAction<string>>;
  workflowError: Error | null;
  observeWorkflowStream?: ({
    workflowId,
    runId,
    storeRunResult,
  }: {
    workflowId: string;
    runId: string;
    storeRunResult: WorkflowRunStreamResult | null;
  }) => void;
  closeStreamsAndReset: () => void;
  timeTravelWorkflowStream: (
    params: {
      workflowId: string;
      requestContext: Record<string, unknown>;
      runId?: string;
    } & Omit<TimeTravelParams, 'requestContext'>,
  ) => Promise<void>;
  runSnapshot?: WorkflowRunState;
  isLoadingRunExecutionResult?: boolean;
  withoutTimeTravel?: boolean;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
} & Omit<WorkflowTriggerProps, 'paramsRunId' | 'setRunId' | 'observeWorkflowStream'>;

// eslint-disable-next-line react-refresh/only-export-components
export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

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
  const [isRunning, setIsRunning] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const hasMountedRef = useRef(false);

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
          } as any,
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId: initialRunId,
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
          value: runExecutionResult?.initialState,
        } as WorkflowRunState)
      : undefined;
  }, [runExecutionResult, initialRunId]);

  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  const { settings } = useTracingSettings();

  const createWorkflowRun = useCreateWorkflowRun();
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
    tracingOptions: settings?.tracingOptions,
    onError: error => toast.error(error.message),
  });
  const cancelWorkflowRun = useCancelWorkflowRun();

  const clearData = () => {
    setResult(null);
    setPayload(null);
  };

  // Reset run-scoped state when navigating to a different workflow or run.
  // The provider stays mounted across same-pattern route changes (React Router
  // reuses the component when only :workflowId/:runId differ), so without this
  // result/payload from the previous run would leak into the next view and the
  // graph would show stale state until the new fetch completed. Skip the first
  // render so we don't wipe the snapshot-initialized state on mount.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setIsRunning(false);
    setRunId(initialRunId ?? '');
    setResult(null);
    setPayload(null);
  }, [initialRunId, workflowId]);

  useEffect(() => {
    if (runSnapshot?.runId) {
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
    }
  }, [runSnapshot]);

  return (
    <WorkflowRunContext.Provider
      value={{
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
        streamWorkflow: props => {
          setIsRunning(true);
          return streamWorkflow.mutateAsync(props);
        },
        resumeWorkflow: props => {
          setIsRunning(true);
          return resumeWorkflowStream.mutateAsync(props);
        },
        streamResult,
        isStreamingWorkflow: isStreaming,
        isCancellingWorkflowRun: cancelWorkflowRun.isPending,
        cancelWorkflowRun: cancelWorkflowRun.mutateAsync,
        observeWorkflowStream: props => {
          setIsRunning(true);
          return observeWorkflowStream.mutate(props);
        },
        closeStreamsAndReset,
        timeTravelWorkflowStream: props => {
          setIsRunning(true);
          return timeTravelWorkflowStream.mutateAsync(props);
        },
        runSnapshot,
        isLoadingRunExecutionResult,
        withoutTimeTravel,
        debugMode,
        setDebugMode,
      }}
    >
      <WorkflowStepDetailProvider>{children}</WorkflowStepDetailProvider>
    </WorkflowRunContext.Provider>
  );
}
