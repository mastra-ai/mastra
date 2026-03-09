import { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

export type StepDetailType = 'map-config' | 'nested-graph' | null;

export type StepDetailData = {
  type: StepDetailType;
  stepName: string;
  stepId?: string;
  mapConfig?: string;
  nestedGraph?: {
    label: string;
    stepGraph: SerializedStepFlowEntry[];
    fullStep: string;
  };
};

type WorkflowStepDetailContextType = {
  stepDetail: StepDetailData | null;
  showMapConfig: (params: { stepName: string; stepId?: string; mapConfig: string }) => void;
  showNestedGraph: (params: { label: string; stepGraph: SerializedStepFlowEntry[]; fullStep: string }) => void;
  closeStepDetail: () => void;
};

export const WorkflowStepDetailContext = createContext<WorkflowStepDetailContextType | null>(null);

export function useWorkflowStepDetail() {
  const context = useContext(WorkflowStepDetailContext);
  if (!context) {
    throw new Error('useWorkflowStepDetail must be used within WorkflowStepDetailProvider');
  }
  return context;
}

export function WorkflowStepDetailProvider({ children }: { children: ReactNode }) {
  const [stepDetail, setStepDetail] = useState<StepDetailData | null>(null);

  const showMapConfig = useCallback(
    ({ stepName, stepId, mapConfig }: { stepName: string; stepId?: string; mapConfig: string }) => {
      setStepDetail({
        type: 'map-config',
        stepName,
        stepId,
        mapConfig,
      });
    },
    [],
  );

  const showNestedGraph = useCallback(
    ({ label, stepGraph, fullStep }: { label: string; stepGraph: SerializedStepFlowEntry[]; fullStep: string }) => {
      setStepDetail({
        type: 'nested-graph',
        stepName: label,
        nestedGraph: {
          label,
          stepGraph,
          fullStep,
        },
      });
    },
    [],
  );

  const closeStepDetail = useCallback(() => {
    setStepDetail(null);
  }, []);

  return (
    <WorkflowStepDetailContext.Provider
      value={{
        stepDetail,
        showMapConfig,
        showNestedGraph,
        closeStepDetail,
      }}
    >
      {children}
    </WorkflowStepDetailContext.Provider>
  );
}
