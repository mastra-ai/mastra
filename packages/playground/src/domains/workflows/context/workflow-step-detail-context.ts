import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { createContext, useContext } from 'react';

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

export type WorkflowStepDetailContextType = {
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
