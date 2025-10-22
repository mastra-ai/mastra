import { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { createContext, useEffect, useState } from 'react';
import { convertWorkflowRunStateToStreamResult } from '../utils';

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
};

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

export function WorkflowRunProvider({
  children,
  snapshot,
}: {
  children: React.ReactNode;
  snapshot?: WorkflowRunState;
}) {
  const [result, setResult] = useState<WorkflowRunStreamResult | null>(() =>
    snapshot ? convertWorkflowRunStateToStreamResult(snapshot) : null,
  );
  const [payload, setPayload] = useState<any>(() => snapshot?.context?.input ?? null);
  const [runId, setRunId] = useState<string>(() => snapshot?.runId ?? '');

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
        result,
        setResult,
        payload,
        setPayload,
        clearData,
        snapshot,
        runId,
        setRunId,
      }}
    >
      {children}
    </WorkflowRunContext.Provider>
  );
}
