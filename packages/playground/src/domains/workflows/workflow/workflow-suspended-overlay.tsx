import { useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useResumeWorkflow, useSuspendedSteps } from './use-workflow-trigger';
import { WorkflowSuspendedSteps } from './workflow-suspended-steps';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export function WorkflowSuspendedOverlay({ hidden }: { hidden?: boolean }) {
  const { result, workflow, runId, isStreamingWorkflow } = useContext(WorkflowRunContext);
  const { canExecute, isLoading: isLoadingPermissions } = usePermissions();
  const suspendedSteps = useSuspendedSteps(result, runId ?? '');
  const onResume = useResumeWorkflow();

  const canResume = result?.status === 'suspended' && !isStreamingWorkflow && workflow && suspendedSteps.length > 0;
  if (!canResume || isLoadingPermissions || !canExecute('workflows')) {
    return null;
  }

  return (
    <div
      key={runId}
      hidden={hidden}
      data-testid="workflow-suspended-overlay"
      className="animate-in fade-in-0 slide-in-from-top-2 pointer-events-none absolute top-12 right-2 z-30 w-[380px] max-w-[calc(100%-16px)] duration-300 motion-reduce:animate-none"
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
