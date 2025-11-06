import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { WorkflowRunStatus } from '@mastra/core/workflows';
import { Check, CirclePause, CircleSlash, Clock, Plus, X } from 'lucide-react';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { ThreadItem, ThreadLink, ThreadList, Threads } from '@/components/threads';
import { useLinkComponent } from '@/lib/framework';
import { formatDate } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/ds/components/Badge';
import Spinner from '@/components/ui/spinner';

export interface WorkflowRunListProps {
  workflowId: string;
  runId?: string;
}

export const WorkflowRunList = ({ workflowId, runId }: WorkflowRunListProps) => {
  const { Link, paths } = useLinkComponent();
  const { isLoading, data: runs } = useWorkflowRuns(workflowId);

  const actualRuns = runs?.runs || [];

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full w-full">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={Link} to={paths.workflowLink(workflowId)}>
              <span className="text-accent1 flex items-center gap-4">
                <Icon className="bg-surface4 rounded-lg" size="lg">
                  <Plus />
                </Icon>
                New workflow run
              </span>
            </ThreadLink>
          </ThreadItem>

          {actualRuns.length === 0 && (
            <Txt variant="ui-md" className="text-icon3 py-3 px-5">
              Your run history will appear here once you run the workflow
            </Txt>
          )}

          {actualRuns.map(run => (
            <ThreadItem isActive={run.runId === runId} key={run.runId} className="h-auto">
              <ThreadLink as={Link} to={paths.workflowRunLink(workflowId, run.runId)}>
                {typeof run?.snapshot === 'object' && (
                  <div className="pb-1">
                    <WorkflowRunStatusBadge status={run.snapshot.status} />
                  </div>
                )}
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
    </div>
  );
};

interface WorkflowRunStatusProps {
  status: WorkflowRunStatus;
}

const WorkflowRunStatusBadge = ({ status }: WorkflowRunStatusProps) => {
  if (status === 'running') {
    return (
      <Badge variant="default" icon={<Spinner />}>
        {status}
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="default" icon={<X className="text-accent2" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'canceled') {
    return (
      <Badge variant="default" icon={<CircleSlash className="text-icon3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'pending' || status === 'waiting') {
    return (
      <Badge variant="default" icon={<Clock className="text-icon3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'suspended') {
    return (
      <Badge variant="default" icon={<CirclePause className="text-accent3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'success') {
    return (
      <Badge variant="default" icon={<Check className="text-accent1" />}>
        {status}
      </Badge>
    );
  }

  return <Badge variant="default">{status}</Badge>;
};
