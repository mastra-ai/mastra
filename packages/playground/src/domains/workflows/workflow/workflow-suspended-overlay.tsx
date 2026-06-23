import { useContext } from 'react';
import { useParams } from 'react-router';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useResumeWorkflow, useSuspendedSteps } from './use-workflow-trigger';
import { WorkflowSuspendedSteps } from './workflow-suspended-steps';

export function WorkflowSuspendedOverlay() {
  const { result, runSnapshot, workflow, runId, isStreamingWorkflow } = useContext(WorkflowRunContext);
  const { runId: routeRunId } = useParams();
  const suspendedSteps = useSuspendedSteps(result, runId ?? '');
  const onResume = useResumeWorkflow();

  // `runSnapshot` is fetched per-run (keyed on the route's runId), so it is the run-accurate
  // source of truth. `result` lags behind during run navigation (it is hydrated asynchronously),
  // so a finished run can briefly keep the previously selected suspended run's steps. Only treat
  // this as "viewing a stored run" when the route has a runId — a live run sets the context runId
  // while streaming, but has no route runId, so its suspended steps must still surface.
  const isViewingStoredRun = Boolean(routeRunId);
  const storedRunIsSuspended = runSnapshot?.status === 'suspended';

  if (
    isStreamingWorkflow ||
    !workflow ||
    suspendedSteps.length === 0 ||
    (isViewingStoredRun && !storedRunIsSuspended)
  ) {
    return null;
  }

  return (
    <div
      key={runId}
      data-testid="workflow-suspended-overlay"
      className="absolute top-2 right-2 z-20 w-[380px] max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] overflow-y-auto rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-top-2 zoom-in-95 duration-300"
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
