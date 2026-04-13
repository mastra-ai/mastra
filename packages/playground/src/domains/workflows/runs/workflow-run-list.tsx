import type { WorkflowRunStatus } from '@mastra/core/workflows';
import {
  AlertDialog,
  Badge,
  Skeleton,
  Spinner,
  ThreadDeleteButton,
  ThreadItem,
  ThreadLink,
  ThreadList,
  Threads,
  Txt,
  Icon,
} from '@mastra/playground-ui';
import { formatDate } from 'date-fns';
import { Check, CirclePause, CircleSlash, Clock, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowRunListProps {
  workflowId: string;
  runId?: string;
}

export const WorkflowRunList = ({ workflowId, runId }: WorkflowRunListProps) => {
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  // Check if user can delete workflow runs
  const canDeleteRun = canDelete('workflows');

  const { Link, paths, navigate } = useLinkComponent();
  const { isLoading, data: runs, setEndOfListElement, isFetchingNextPage } = useWorkflowRuns(workflowId);
  const { mutateAsync: deleteRun } = useDeleteWorkflowRun(workflowId);

  const handleDelete = async (runId: string) => {
    try {
      await deleteRun({ runId });
      setDeleteRunId(null);
      navigate(paths.workflowLink(workflowId));
    } catch {
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
            <Txt variant="ui-md" className="text-neutral3 py-3 px-5">
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
                <span className="truncate max-w-32 text-neutral3">{run.runId}</span>
                <span>
                  {typeof run?.snapshot === 'string'
                    ? ''
                    : run?.snapshot?.timestamp
                      ? formatDate(run?.snapshot?.timestamp, 'MMM d, yyyy h:mm a')
                      : ''}
                </span>
              </ThreadLink>

              {canDeleteRun && <ThreadDeleteButton onClick={() => setDeleteRunId(run.runId)} />}
            </ThreadItem>
          ))}
        </ThreadList>
      </Threads>

      <DeleteRunDialog
        open={!!deleteRunId}
        onOpenChange={() => setDeleteRunId(null)}
        onDelete={() => {
          if (deleteRunId) {
            void handleDelete(deleteRunId);
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
      <Badge variant="default" icon={<CircleSlash className="text-neutral3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'pending' || status === 'waiting') {
    return (
      <Badge variant="default" icon={<Clock className="text-neutral3" />}>
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
