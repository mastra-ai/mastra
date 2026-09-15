import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { createContext, useContext } from 'react';

export type WorkflowDataSelection =
  | { type: 'step-input' | 'step-output'; stepId: string }
  | { type: 'workflow-input' | 'workflow-output'; workflowName?: string };

export type StepDetailData =
  | { type: 'data'; selection: WorkflowDataSelection }
  | { type: 'map-config'; stepName: string; stepId?: string; mapConfig: string }
  | {
      type: 'nested-graph';
      stepName: string;
      nestedGraph: { label: string; stepGraph: SerializedStepFlowEntry[]; fullStep: string };
    };

export type StepDetailType = StepDetailData['type'];

export type WorkflowStepDetailContextType = {
  stepDetail: StepDetailData | null;
  showMapConfig: (params: { stepName: string; stepId?: string; mapConfig: string }) => void;
  showNestedGraph: (params: { label: string; stepGraph: SerializedStepFlowEntry[]; fullStep: string }) => void;
  showData: (selection: WorkflowDataSelection, trigger: HTMLButtonElement) => void;
  closeStepDetail: () => void;
  resetStepDetail: () => void;
};

export const WorkflowStepDetailContext = createContext<WorkflowStepDetailContextType | null>(null);

export function useWorkflowStepDetail() {
  const context = useContext(WorkflowStepDetailContext);
  if (!context) {
    throw new Error('useWorkflowStepDetail must be used within WorkflowStepDetailProvider');
  }
  return context;
}
