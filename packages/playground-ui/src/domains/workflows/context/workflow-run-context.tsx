import { ExtendedLegacyWorkflowRunResult, ExtendedWorkflowWatchResult } from '@/hooks/use-workflows';
import { WorkflowRunState } from '@mastra/core/workflows';
import { WorkflowWatchResult } from '@mastra/client-js';
import { createContext, useEffect, useState } from 'react';
import { convertWorkflowRunStateToWatchResult } from '../utils';

type WorkflowRunContextType = {
  legacyResult: ExtendedLegacyWorkflowRunResult | null;
  setLegacyResult: React.Dispatch<React.SetStateAction<any>>;
  result: WorkflowWatchResult | null;
  setResult: React.Dispatch<React.SetStateAction<any>>;
  payload: any;
  setPayload: React.Dispatch<React.SetStateAction<any>>;
  clearData: () => void;
  snapshot?: WorkflowRunState;
};

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

export function WorkflowRunProvider({
  children,
  snapshot,
}: {
  children: React.ReactNode;
  snapshot?: WorkflowRunState;
}) {
  const [legacyResult, setLegacyResult] = useState<ExtendedLegacyWorkflowRunResult | null>(null);
  const [result, setResult] = useState<WorkflowWatchResult | null>(() =>
    snapshot ? convertWorkflowRunStateToWatchResult(snapshot) : null,
  );
  const [payload, setPayload] = useState<any>(null);

  const clearData = () => {
    setLegacyResult(null);
    setResult(null);
    setPayload(null);
  };

  useEffect(() => {
    if (snapshot?.runId) {
      setResult(convertWorkflowRunStateToWatchResult(snapshot));
    } else {
      setResult(null);
    }
  }, [snapshot?.runId ?? '']);

  return (
    <WorkflowRunContext.Provider
      value={{
        legacyResult,
        setLegacyResult,
        result,
        setResult,
        payload,
        setPayload,
        clearData,
        snapshot,
      }}
    >
      {children}
    </WorkflowRunContext.Provider>
  );
}
