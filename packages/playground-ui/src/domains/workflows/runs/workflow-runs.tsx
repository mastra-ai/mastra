import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt';
import { formatDate } from 'date-fns';

import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { ThreadItem, ThreadLink, ThreadList, Threads } from '@/components/threads';
import { useLinkComponent } from '@/lib/framework';
import { Icon } from '@/ds/icons';
import { History } from 'lucide-react';

export interface WorkflowRunsProps {
  workflowId: string;
  runId?: string;
}

export const WorkflowRuns = ({ workflowId, runId }: WorkflowRunsProps) => {
  const { Link, paths } = useLinkComponent();
  const { isLoading, data: runs } = useWorkflowRuns(workflowId);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const actualRuns = runs?.runs || [];

  return (
    <div className="overflow-y-auto h-full w-full">
      <Txt
        variant="ui-md"
        className="text-icon3 py-2 px-3 border-b-sm border-border1 border-r-sm flex items-center gap-1"
      >
        <Icon>
          <History />
        </Icon>
        Runs history
      </Txt>
      {actualRuns.length === 0 ? (
        <Txt variant="ui-md" className="text-icon6 p-4">
          Your run history will appear here once you run the workflow
        </Txt>
      ) : (
        <Threads>
          <ThreadList>
            {actualRuns.map(run => (
              <ThreadItem isActive={run.runId === runId} key={run.runId}>
                <ThreadLink as={Link} to={paths.workflowRunLink(workflowId, run.runId)}>
                  <span className="truncate max-w-[14rem] text-muted-foreground">{run.runId}</span>
                  <span>
                    {typeof run?.snapshot === 'string'
                      ? ''
                      : run?.snapshot?.timestamp
                        ? formatDate(run?.snapshot?.timestamp, 'MMM d, yyyy h:mm a')
                        : ''}
                  </span>
                </ThreadLink>
              </ThreadItem>
            ))}
          </ThreadList>
        </Threads>
      )}
    </div>
  );
};
