import { useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useResumeWorkflow, useSuspendedSteps } from './use-workflow-trigger';
import { WorkflowSuspendedSteps } from './workflow-suspended-steps';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export function WorkflowSuspendedOverlay() {
  const { result, workflow, runId, isStreamingWorkflow } = useContext(WorkflowRunContext);
  const { canExecute, isLoading: isLoadingPermissions } = usePermissions();
  const suspendedSteps = useSuspendedSteps(result, runId);
  const onResume = useResumeWorkflow();

  const waitsForHumanInput = result?.status === 'suspended' && suspendedSteps.length > 0 && !isStreamingWorkflow;
  const mayResume = !isLoadingPermissions && canExecute('workflows');
  if (!workflow || !waitsForHumanInput || !mayResume) return null;

  return (
    <div
      key={runId}
      data-testid="workflow-suspended-overlay"
      className="animate-in fade-in-0 slide-in-from-top-2 zoom-in-95 absolute top-2 right-2 z-20 max-h-[calc(100%-1rem)] w-[380px] max-w-[calc(100%-1rem)] overflow-y-auto rounded-lg shadow-lg duration-300"
    >
      <WorkflowSuspendedSteps
        suspendedSteps={suspendedSteps}
        workflow={workflow}
        isStreaming={isStreamingWorkflow}
        onResume={onResume}
      />
    </div>
  );
}
