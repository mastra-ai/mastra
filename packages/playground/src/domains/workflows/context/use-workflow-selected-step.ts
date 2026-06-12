import { useContext } from 'react';

import { WorkflowSelectedStepContext } from './workflow-selected-step-context-value';

export function useWorkflowSelectedStep() {
  const context = useContext(WorkflowSelectedStepContext);

  if (!context) {
    throw new Error('useWorkflowSelectedStep must be used within a WorkflowSelectedStepProvider');
  }

  return context;
}
