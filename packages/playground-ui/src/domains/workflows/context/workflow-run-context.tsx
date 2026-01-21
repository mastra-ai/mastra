import { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { createContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { convertWorkflowRunStateToStreamResult } from '../utils';
import { useCreateWorkflowRun, useCancelWorkflowRun } from '@mastra/react';
import { useStreamWorkflow } from '../hooks';
import { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { useWorkflow, useWorkflowRun } from '@/hooks';
import { TimeTravelParams } from '@mastra/client-js';
import { WorkflowStepDetailProvider } from './workflow-step-detail-context';

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

  const createWorkflowRun = useCreateWorkflowRun();
  const {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
    timeTravelWorkflowStream,
  } = useStreamWorkflow({ debugMode });
  const cancelWorkflowRun = useCancelWorkflowRun();

  const clearData = () => {
    setResult(null);
    setPayload(null);
  };

  useEffect(() => {
    setIsRunning(false);
  }, [initialRunId]);

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
