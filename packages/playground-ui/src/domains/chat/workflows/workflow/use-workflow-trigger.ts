import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';

export function useWaitingStepKey() {
  return useContext(WorkflowRunContext).waitingStepKey;
}

export function useSuspendedStepKey() {
  const { result } = useContext(WorkflowRunContext);
  return Object.entries(result?.steps ?? {}).find(([, step]) => step.status === 'suspended')?.[0];
}
