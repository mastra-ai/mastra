import { useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useResumeWorkflow, useSuspendedSteps } from './use-workflow-trigger';
import { WorkflowSuspendedSteps } from './workflow-suspended-steps';

export interface WorkflowSuspendedOverlayProps {
  hidden?: boolean;
  requestContext: Record<string, any>;
  canResume: boolean;
}

export function WorkflowSuspendedOverlay({ hidden, requestContext, canResume }: WorkflowSuspendedOverlayProps) {
  const { result, workflow, runId, isStreamingWorkflow } = useContext(WorkflowRunContext);
  const suspendedSteps = useSuspendedSteps(result, runId);
  const onResume = useResumeWorkflow(requestContext);

  const waitsForHumanInput = result?.status === 'suspended' && suspendedSteps.length > 0 && !isStreamingWorkflow;
  if (!workflow || !waitsForHumanInput || !canResume) return null;

  return (
    <div
      key={runId}
      hidden={hidden}
      data-testid="workflow-suspended-overlay"
      className="pointer-events-none absolute top-12 right-2 z-30 w-95 max-w-[calc(100%-16px)] animate-in duration-300 fade-in-0 slide-in-from-top-2 motion-reduce:animate-none"
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
