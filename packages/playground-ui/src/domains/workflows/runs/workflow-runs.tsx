import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt';
import { formatDate } from 'date-fns';
import clsx from 'clsx';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { WorkflowTrigger, WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { convertWorkflowRunStateToWatchResult } from '../utils';
import { Icon } from '@/ds/icons';
import { ChevronLeftIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { isObjectEmpty } from '@/lib/object';

export interface WorkflowRunsProps extends Omit<WorkflowTriggerProps, 'paramsRunId' | 'workflowId'> {
  workflowId: string;
  runId?: string;
  onPressRun: ({ workflowId, runId }: { workflowId: string; runId: string }) => void;
  onPressBackToRuns: () => void;
}

export const WorkflowRuns = ({
  workflowId,
  runId,
  onPressRun,
  onPressBackToRuns,
  observeWorkflowStream,
  ...triggerProps
}: WorkflowRunsProps) => {
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
        <div className="px-5 space-y-2">
          <Button onClick={onPressBackToRuns} variant="light">
            <Icon>
              <ChevronLeftIcon />
            </Icon>
            Back to runs
          </Button>
        </div>
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

  return (
    <ol className="pb-10">
      {actualRuns.map(run => (
        <li key={run.runId}>
          <button
            onClick={() => onPressRun({ workflowId, runId: run.runId })}
            className={clsx('px-3 py-2 border-b-sm border-border1 block w-full hover:bg-surface4 text-left', {
              'bg-surface4': run.runId === runId,
            })}
          >
            <Txt variant="ui-lg" className="font-medium text-icon6 truncate" as="p">
              {run.runId}
            </Txt>

            <Txt variant="ui-sm" className="font-medium text-icon3 truncate" as="p">
              {typeof run?.snapshot === 'string'
                ? ''
                : run?.snapshot?.timestamp
                  ? formatDate(run?.snapshot?.timestamp, 'MMM d, yyyy h:mm a')
                  : ''}
            </Txt>
          </button>
        </li>
      ))}
    </ol>
  );
};
