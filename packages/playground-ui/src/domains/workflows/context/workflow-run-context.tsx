import { ExtendedWorkflowRunResult } from '@/hooks/use-workflows';
import { createContext, useState } from 'react';

type WorkflowRunContextType = {
  result: ExtendedWorkflowRunResult | null;
  setResult: React.Dispatch<React.SetStateAction<any>>;
  payload: any;
  setPayload: React.Dispatch<React.SetStateAction<any>>;
  clearData: () => void;
};

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);

export function WorkflowRunProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ExtendedWorkflowRunResult | null>(null);
  const [payload, setPayload] = useState<any>(null);

  const clearData = () => {
    setResult(null);
    setPayload(null);
  };

  return (
    <WorkflowRunContext.Provider
      value={{
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
