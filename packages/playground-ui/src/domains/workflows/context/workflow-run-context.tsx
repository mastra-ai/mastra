import { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { createContext, useEffect, useState } from 'react';
import { convertWorkflowRunStateToStreamResult } from '../utils';
import { useCancelWorkflowRun, useExecuteWorkflow, useStreamWorkflow } from '../hooks';
import { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { useWorkflow } from '@/hooks';
import { TimeTravelParams } from '@mastra/client-js';

export type WorkflowRunStreamResult = WorkflowStreamResult<any, any, any, any>;

type WorkflowRunContextType = {
  result: WorkflowRunStreamResult | null;
  setResult: React.Dispatch<React.SetStateAction<WorkflowRunStreamResult | null>>;
  payload: any;
  setPayload: React.Dispatch<React.SetStateAction<any>>;
  clearData: () => void;
  snapshot?: WorkflowRunState;
  runId?: string;
  setRunId: React.Dispatch<React.SetStateAction<string>>;
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
    } & Omit<TimeTravelParams, 'requestContext'>,
  ) => Promise<void>;
} & Omit<WorkflowTriggerProps, 'paramsRunId' | 'setRunId' | 'observeWorkflowStream'>;

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

export function WorkflowRunProvider({
  children,
  snapshot,
  workflowId,
}: {
  children: React.ReactNode;
  snapshot?: WorkflowRunState;
  workflowId: string;
}) {
  const [result, setResult] = useState<WorkflowRunStreamResult | null>(() =>
    snapshot ? convertWorkflowRunStateToStreamResult(snapshot) : null,
  );
  const [payload, setPayload] = useState<any>(() => snapshot?.context?.input ?? null);
  const [runId, setRunId] = useState<string>(() => snapshot?.runId ?? '');

  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

  const { createWorkflowRun } = useExecuteWorkflow();
  const {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
    timeTravelWorkflowStream,
  } = useStreamWorkflow();
  const { mutateAsync: cancelWorkflowRun, isPending: isCancellingWorkflowRun } = useCancelWorkflowRun();

  const clearData = () => {
    setResult(null);
    setPayload(null);
  };

  useEffect(() => {
    if (snapshot?.runId) {
      setResult(convertWorkflowRunStateToStreamResult(snapshot));
      setPayload(snapshot.context?.input);
      setRunId(snapshot.runId);
    }
  }, [snapshot]);

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
        streamWorkflow: streamWorkflow.mutateAsync,
        resumeWorkflow: resumeWorkflowStream.mutateAsync,
        streamResult,
        isStreamingWorkflow: isStreaming,
        isCancellingWorkflowRun,
        cancelWorkflowRun,
        observeWorkflowStream: observeWorkflowStream.mutate,
        closeStreamsAndReset,
        timeTravelWorkflowStream: timeTravelWorkflowStream.mutateAsync,
      }}
    >
      {children}
    </WorkflowRunContext.Provider>
  );
}
