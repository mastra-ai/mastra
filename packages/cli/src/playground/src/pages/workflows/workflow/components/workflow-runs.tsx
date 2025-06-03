import { Skeleton } from '@/components/ui/skeleton';
import { useWorkflowRuns } from '../hooks/use-workflow-runs';
import { Txt } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { formatDate } from 'date-fns';
import clsx from 'clsx';

export interface WorkflowRunsProps {
  workflowId: string;
  runId?: string;
}

export const WorkflowRuns = ({ workflowId, runId }: WorkflowRunsProps) => {
  const { isLoading, data: runs } = useWorkflowRuns({ workflowId });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <ol className="pb-10">
      {runs?.runs.map(run => (
        <li key={run.runId}>
          <Link
            to={`/workflows/${workflowId}/graph/${run.runId}`}
            className={clsx('px-3 py-2 border-b-sm border-border1 block w-full hover:bg-surface4', {
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
          </Link>
        </li>
      ))}
    </ol>
  );
};
