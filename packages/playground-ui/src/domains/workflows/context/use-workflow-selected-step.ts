import { useContext } from 'react';

import { WorkflowSelectedStepContext } from './workflow-selected-step-context-value';

export function useWorkflowSelectedStep() {
  return useContext(WorkflowSelectedStepContext);
}
