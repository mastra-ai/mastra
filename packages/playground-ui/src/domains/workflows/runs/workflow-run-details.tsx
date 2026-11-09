import { useCallback, useContext } from 'react';
import type { WorkflowRunContextType } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { isWorkflowRunFinished } from '../utils';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { WorkflowTrigger } from '../workflow/workflow-trigger';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

export interface WorkflowRunDetailProps extends Omit<
  WorkflowTriggerProps,
  'paramsRunId' | 'workflowId' | 'observeWorkflowStream'
> {
  workflowId: string;
  runId?: string;
  observeWorkflowStream?: WorkflowRunContextType['observeWorkflowStream'];
}

export const WorkflowRunDetail = ({
  workflowId,
  runId,
  observeWorkflowStream,
  ...triggerProps
}: WorkflowRunDetailProps) => {
  const { runSnapshot, isLoadingRunExecutionResult } = useContext(WorkflowRunContext);

  const observeSelectedRun = useCallback(() => {
    if (!runId || !runSnapshot || isWorkflowRunFinished(runSnapshot.status)) return;
    observeWorkflowStream?.({
      workflowId,
      runId,
      storedStatus: runSnapshot.status,
    });
  }, [workflowId, runId, runSnapshot, observeWorkflowStream]);

  if (isLoadingRunExecutionResult) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="shrink-0 space-y-2">
            <Skeleton className="ml-auto h-3 w-12" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-3/4 rounded-md" />
        </div>
      </div>
    );
  }

  if (!runSnapshot || !runId) {
    return (
      <div className="p-4">
        <Txt variant="body" tone="ink" className="text-center">
          No previous run
        </Txt>
      </div>
    );
  }

  return (
    <WorkflowTrigger
      key={`${workflowId}:${runId}`}
      {...triggerProps}
      paramsRunId={runId}
      paramsRunStatus={runSnapshot.status}
      workflowId={workflowId}
      observeWorkflowStream={observeSelectedRun}
    />
  );
};
