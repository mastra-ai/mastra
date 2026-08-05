import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
} from '@mastra/playground-ui/components/ThreadList';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { formatDate } from 'date-fns';
import { useState } from 'react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowRecentRunsProps {
  workflowId: string;
  runId?: string;
}

function formatRunInput(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const input = (snapshot as { context?: { input?: unknown } }).context?.input;
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === 'string') {
    return input;
  }

  const inputValue =
    typeof input === 'object' && input !== null && 'output' in input ? (input as { output: unknown }).output : input;

  try {
    return JSON.stringify(inputValue);
  } catch {
    return null;
  }
}

export const WorkflowRecentRuns = ({ workflowId, runId }: WorkflowRecentRunsProps) => {
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

  return (
    <>
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div>
          <div className="px-5 pt-3 pb-2 text-left">
            <Txt as="h2" variant="ui-md" className="text-neutral3">
              Recent runs
            </Txt>
          </div>
          <ThreadList aria-label="Workflow runs" embedded>
            {actualRuns.length === 0 ? (
              <ThreadListEmpty>Your run history will appear here once you run the workflow</ThreadListEmpty>
            ) : (
              <ThreadListItems>
                {actualRuns.map(run => {
                  const isActiveRun = run.runId === runId;
                  const runInput = isActiveRun ? formatRunInput(run.snapshot) : null;

                  return (
                    <ThreadListItem
                      key={`run-${run.runId}`}
                      as={Link}
                      to={paths.workflowRunLink(workflowId, run.runId)}
                      isActive={isActiveRun}
                      onDelete={canDeleteRun ? () => setDeleteRunId(run.runId) : undefined}
                      deleteLabel="delete run"
                      className="h-auto min-h-0 items-stretch py-1"
                    >
                      <span className="flex w-full min-w-0 items-center gap-2.5 px-1 text-left">
                        {run?.snapshot && typeof run.snapshot === 'object' && (
                          <span className="shrink-0">
                            <WorkflowRunStatusIcon status={run.snapshot.status} />
                          </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                          <span className="flex w-full min-w-0 items-center gap-2 text-xs">
                            <span className="text-neutral5 min-w-0 flex-1 truncate font-medium" title={run.runId}>
                              {run.runId}
                            </span>
                            {run?.snapshot && typeof run.snapshot === 'object' && run.snapshot.timestamp && (
                              <span className="text-neutral3 shrink-0">
                                {formatDate(run.snapshot.timestamp, 'MMM d, yyyy h:mm a')}
                              </span>
                            )}
                          </span>
                          {runInput && (
                            <span className="text-neutral3 block w-full min-w-0 truncate text-xs">{runInput}</span>
                          )}
                        </span>
                      </span>
                    </ThreadListItem>
                  );
                })}

                {isFetchingNextPage && (
                  <li className="flex items-center justify-center py-2">
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
      )}

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
