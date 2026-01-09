import { createContext } from 'react';
import { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { useWorkflowStepDetail } from './workflow-step-detail-context';

type WorkflowNestedGraphContextType = {
  showNestedGraph: ({
    label,
    stepGraph,
    fullStep,
  }: {
    label: string;
    stepGraph: SerializedStepFlowEntry[];
    fullStep: string;
  }) => void;
  closeNestedGraph: () => void;
};

const WorkflowNestedGraphContext = createContext<WorkflowNestedGraphContextType>(
  {} as WorkflowNestedGraphContextType,
);

export function WorkflowNestedGraphProvider({ children }: { children: React.ReactNode }) {
  const { showNestedGraph: showNestedGraphInPanel, closeStepDetail } = useWorkflowStepDetail();

  const showNestedGraph = ({
    label,
    stepGraph,
    fullStep,
  }: {
    label: string;
    stepGraph: SerializedStepFlowEntry[];
    fullStep: string;
  }) => {
    showNestedGraphInPanel({ label, stepGraph, fullStep });
  };

  const closeNestedGraph = () => {
    closeStepDetail();
  };

  return (
    <WorkflowNestedGraphContext.Provider
      value={{
        showNestedGraph,
        closeNestedGraph,
      }}
    >
      {children}
    </WorkflowNestedGraphContext.Provider>
  );
}
