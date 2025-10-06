import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt';

import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { WorkflowTrigger, WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { convertWorkflowRunStateToWatchResult } from '../utils';

import { isObjectEmpty } from '@/lib/object';

export interface WorkflowRunDetailProps extends Omit<WorkflowTriggerProps, 'paramsRunId' | 'workflowId'> {
  workflowId: string;
  runId?: string;
  onPressRun: ({ workflowId, runId }: { workflowId: string; runId: string }) => void;
  onPressBackToRuns: () => void;
}

export const WorkflowRunDetail = ({
  workflowId,
  runId,
  onPressRun,
  onPressBackToRuns,
  observeWorkflowStream,
  ...triggerProps
}: WorkflowRunDetailProps) => {
  const { isLoading, data: runs } = useWorkflowRuns(workflowId);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const actualRuns = runs?.runs || [];

  if (actualRuns.length === 0) {
    return (
      <div className="p-4">
        <Txt variant="ui-md" className="text-icon6 text-center">
          No previous run
        </Txt>
      </div>
    );
  }

  const run = actualRuns.find(run => run.runId === runId);
  const runSnapshot = run?.snapshot;

  const runResult =
    runSnapshot && typeof runSnapshot === 'object' ? convertWorkflowRunStateToWatchResult(runSnapshot) : null;
  const runStatus = runResult?.payload?.workflowState?.status;

  if (runId) {
    return (
      <div className="h-full grid grid-rows-[1fr_auto]">
        <WorkflowTrigger
          {...triggerProps}
          // isStreamingWorkflow={runStatus === 'suspended' ? false : triggerProps.isStreamingWorkflow}
          streamResult={isObjectEmpty(triggerProps.streamResult ?? {}) ? runResult : triggerProps.streamResult}
          paramsRunId={runId}
          workflowId={workflowId}
          observeWorkflowStream={() => {
            if (runStatus !== 'success' && runStatus !== 'failed' && runStatus !== 'canceled') {
              observeWorkflowStream?.({ workflowId, runId });
            }
          }}
        />
      </div>
    );
  }
};
