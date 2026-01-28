import { Icon } from '@/ds/icons';
import { WorkflowRunStatus } from '@mastra/core/workflows';
import { Check, CirclePause, CircleSlash, Clock, X } from 'lucide-react';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { NewThreadLink, ThreadDeleteButton, ThreadEmpty, ThreadItem, ThreadLink, ThreadList, Threads } from '@/ds/components/Threads';
import { useLinkComponent } from '@/lib/framework';
import { Truncate } from '@/ds/components/Truncate';
import { Skeleton } from '@/ds/components/Skeleton';
import { Badge } from '@/ds/components/Badge';
import { Spinner } from '@/ds/components/Spinner';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useState } from 'react';

export interface WorkflowRunListProps {
  workflowId: string;
  runId?: string;
}

export const WorkflowRunList = ({ workflowId, runId }: WorkflowRunListProps) => {
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);

  const { Link, paths, navigate } = useLinkComponent();
  const { isLoading, data: runs, setEndOfListElement, isFetchingNextPage } = useWorkflowRuns(workflowId);
  const { mutateAsync: deleteRun } = useDeleteWorkflowRun(workflowId);

  const handleDelete = async (runId: string) => {
    try {
      await deleteRun({ runId });
      setDeleteRunId(null);
      navigate(paths.workflowLink(workflowId));
    } catch (_error) {
      setDeleteRunId(null);
    }
  };

  const actualRuns = runs || [];

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
            <NewThreadLink as={Link} to={paths.workflowLink(workflowId)} label="New workflow run" />
          </ThreadItem>

          {actualRuns.length === 0 && (
            <ThreadEmpty>Your run history will appear here once you run the workflow</ThreadEmpty>
          )}

          {actualRuns.map(run => {
            const isActive = run.runId === runId;
            return (
              <ThreadItem isActive={isActive} key={run.runId}>
                <ThreadLink as={Link} to={paths.workflowRunLink(workflowId, run.runId)} isActive={isActive}>
                  <span className="flex items-center gap-2">
                    {typeof run?.snapshot === 'object' && <WorkflowRunStatusBadge status={run.snapshot.status} />}
                    <Truncate variant="ui-sm" className="text-neutral3" untilChar="-">
                      {run.runId}
                    </Truncate>
                  </span>
                </ThreadLink>

                <ThreadDeleteButton onClick={() => setDeleteRunId(run.runId)} />
              </ThreadItem>
            );
          })}
        </ThreadList>
      </Threads>

      <DeleteRunDialog
        open={!!deleteRunId}
        onOpenChange={() => setDeleteRunId(null)}
        onDelete={() => {
          if (deleteRunId) {
            handleDelete(deleteRunId);
          }
        }}
      />

      {isFetchingNextPage && (
        <div className="flex justify-center items-center">
          <Icon>
            <Spinner />
          </Icon>
        </div>
      )}
      <div ref={setEndOfListElement} />
    </div>
  );
};

interface WorkflowRunStatusProps {
  status: WorkflowRunStatus;
}

const WorkflowRunStatusBadge = ({ status }: WorkflowRunStatusProps) => {
  if (status === 'running') {
    return <Badge variant="default" icon={<Spinner />} />;
  }

  if (status === 'failed') {
    return <Badge variant="default" icon={<X className="text-accent2" />} />;
  }

  if (status === 'canceled') {
    return <Badge variant="default" icon={<CircleSlash className="text-neutral3" />} />;
  }

  if (status === 'pending' || status === 'waiting') {
    return <Badge variant="default" icon={<Clock className="text-neutral3" />} />;
  }

  if (status === 'suspended') {
    return <Badge variant="default" icon={<CirclePause className="text-accent3" />} />;
  }

  if (status === 'success') {
    return <Badge variant="default" icon={<Check className="text-accent1" />} />;
  }

  return <Badge variant="default" />;
};

interface DeleteRunDialogProps {
  open: boolean;
  onOpenChange: (n: boolean) => void;
  onDelete: () => void;
}
const DeleteRunDialog = ({ open, onOpenChange, onDelete }: DeleteRunDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone. This will permanently delete the workflow run and remove it from our servers.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onDelete}>Continue</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
};
