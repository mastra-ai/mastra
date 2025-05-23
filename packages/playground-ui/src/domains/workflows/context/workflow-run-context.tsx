import { ExtendedLegacyWorkflowRunResult, ExtendedWorkflowWatchResult } from '@/hooks/use-workflows';
import { createContext, useState } from 'react';

type WorkflowRunContextType = {
  legacyResult: ExtendedLegacyWorkflowRunResult | null;
  setLegacyResult: React.Dispatch<React.SetStateAction<any>>;
  result: ExtendedWorkflowWatchResult | null;
  setResult: React.Dispatch<React.SetStateAction<any>>;
  payload: any;
  setPayload: React.Dispatch<React.SetStateAction<any>>;
  clearData: () => void;
};

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

export function WorkflowRunProvider({ children }: { children: React.ReactNode }) {
  const [legacyResult, setLegacyResult] = useState<ExtendedLegacyWorkflowRunResult | null>(null);
  const [result, setResult] = useState<ExtendedWorkflowWatchResult | null>(null);
  const [payload, setPayload] = useState<any>(null);

  const clearData = () => {
    setLegacyResult(null);
    setResult(null);
    setPayload(null);
  };

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
      }}
    >
      {children}
    </WorkflowRunContext.Provider>
  );
}
