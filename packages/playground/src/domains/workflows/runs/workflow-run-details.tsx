import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useContext } from 'react';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { convertWorkflowRunStateToStreamResult } from '../utils';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { WorkflowTrigger } from '../workflow/workflow-trigger';

export interface WorkflowRunDetailProps extends Omit<
  WorkflowTriggerProps,
  'paramsRunId' | 'workflowId' | 'observeWorkflowStream'
> {
  workflowId: string;
  runId?: string;
  observeWorkflowStream?: ({
    workflowId,
    runId,
    storeRunResult,
  }: {
    workflowId: string;
    runId: string;
    storeRunResult: WorkflowRunStreamResult | null;
  }) => void;
}

export const WorkflowRunDetail = ({
  workflowId,
  runId,
  observeWorkflowStream,
  ...triggerProps
}: WorkflowRunDetailProps) => {
  const { runSnapshot, isLoadingRunExecutionResult } = useContext(WorkflowRunContext);

  if (isLoadingRunExecutionResult) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="shrink-0 space-y-2">
            <Skeleton className="ml-auto h-3 w-12" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        </div>

        {/* "Run input" label + Form/JSON toggle */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>

        {/* Form fields */}
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
        <Txt variant="ui-md" className="text-neutral6 text-center">
          No previous run
        </Txt>
      </div>
    );
  }

  const runResult = convertWorkflowRunStateToStreamResult(runSnapshot);
  const runStatus = runResult?.status;

  if (runId) {
    return (
      <div className="grid h-full grid-rows-[1fr_auto]">
        <WorkflowTrigger
          {...triggerProps}
          paramsRunId={runId}
          workflowId={workflowId}
          observeWorkflowStream={() => {
            if (runStatus !== 'success' && runStatus !== 'failed' && runStatus !== 'canceled') {
              observeWorkflowStream?.({ workflowId, runId, storeRunResult: runResult });
            }
          }}
        />
      </div>
    );
  }
};
