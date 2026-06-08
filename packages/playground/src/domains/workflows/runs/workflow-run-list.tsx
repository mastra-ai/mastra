import { AlertDialog, Icon, Skeleton, Spinner, Txt } from '@mastra/playground-ui';
import { formatDate } from 'date-fns';
import { useState } from 'react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import { ThreadList, ThreadListEmpty, ThreadListItem, ThreadListItems } from '@/components/thread-list';
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
      <div className="h-full w-full p-2">
        <div className="h-full min-w-0 w-full overflow-hidden rounded-studio-panel border border-border1/50 bg-surface3">
          <ThreadList aria-label="Workflow runs" embedded>
            <Txt as="p" variant="ui-sm" className="text-neutral3 px-3 pb-2 pt-1">
              Workflow run history
            </Txt>
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
                  className="h-auto min-h-form-default items-stretch py-2"
                >
                  <span className="flex w-full min-w-0 items-center gap-2 px-1 text-left">
                    {run?.snapshot && typeof run.snapshot === 'object' && (
                      <WorkflowRunStatusIcon status={run.snapshot.status} />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="block w-full min-w-0 truncate">{run.runId}</span>
                      {run?.snapshot && typeof run.snapshot === 'object' && run.snapshot.timestamp && (
                        <span className="text-neutral3 block w-full max-w-full truncate">
                          {formatDate(run.snapshot.timestamp, 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                    </span>
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
              <li>
                <div ref={setEndOfListElement} />
              </li>
            </ThreadListItems>
          )}
          </ThreadList>
        </div>
      </div>

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
