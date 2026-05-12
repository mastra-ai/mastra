import { AlertDialog, Icon, Skeleton, Spinner } from '@mastra/playground-ui';
import { formatDate } from 'date-fns';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { WorkflowRunStatusBadge } from '../components/workflow-run-status-badge';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from '@/components/thread-list';
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
    <>
      <ThreadList aria-label="Workflow runs">
        <ThreadListNewItem as={Link} to={paths.workflowLink(workflowId)}>
          <Icon>
            <Plus />
          </Icon>
          New workflow run
        </ThreadListNewItem>
        <ThreadListSeparator />

        {actualRuns.length === 0 ? (
          <ThreadListEmpty>Your run history will appear here once you run the workflow</ThreadListEmpty>
        ) : (
          <ThreadListItems>
            {actualRuns.map(run => (
              <ThreadListItem
                key={run.runId}
                as={Link}
                to={paths.workflowRunLink(workflowId, run.runId)}
                isActive={run.runId === runId}
                onDelete={canDeleteRun ? () => setDeleteRunId(run.runId) : undefined}
                deleteLabel="delete run"
              >
                <span className="flex flex-col items-start gap-1 text-left">
                  {run?.snapshot && typeof run.snapshot === 'object' && (
                    <WorkflowRunStatusBadge status={run.snapshot.status} />
                  )}
                  <span className="truncate">{run.runId}</span>
                  {run?.snapshot && typeof run.snapshot === 'object' && run.snapshot.timestamp && (
                    <span>{formatDate(run.snapshot.timestamp, 'MMM d, yyyy h:mm a')}</span>
                  )}
                </span>
              </ThreadListItem>
            ))}

            {isFetchingNextPage && (
              <li className="flex justify-center items-center py-2">
                <Icon>
                  <Spinner />
                </Icon>
              </li>
            )}
            <li ref={setEndOfListElement} />
          </ThreadListItems>
        )}
      </ThreadList>

      <DeleteRunDialog
        open={!!deleteRunId}
        onOpenChange={() => setDeleteRunId(null)}
        onDelete={() => {
          if (deleteRunId) {
            void handleDelete(deleteRunId);
          }
        }}
      />
    </>
  );
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
