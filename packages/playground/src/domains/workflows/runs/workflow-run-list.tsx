import {
  AlertDialog,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  Skeleton,
  Spinner,
  Txt,
} from '@mastra/playground-ui';
import { formatDate } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import { ThreadList, ThreadListEmpty, ThreadListItem, ThreadListItems } from '@/components/thread-list';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowRecentRunsProps {
  workflowId: string;
  runId?: string;
}

function formatRunTitle(snapshot: unknown, fallback: string): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return fallback;
  }

  const input = (snapshot as { context?: { input?: unknown } }).context?.input;
  if (input === undefined || input === null) {
    return fallback;
  }

  if (typeof input === 'string') {
    return input;
  }

  try {
    return JSON.stringify(input);
  } catch {
    return fallback;
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
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-5 pb-2 pt-1 text-left">
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral3" />
            <Txt as="span" variant="ui-sm" className="text-neutral3">
              Recent runs
            </Txt>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ThreadList aria-label="Workflow runs" embedded>
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
                      className="h-auto min-h-0 items-stretch py-1"
                    >
                      <span className="flex w-full min-w-0 items-center gap-2.5 px-1 text-left">
                        {run?.snapshot && typeof run.snapshot === 'object' && (
                          <WorkflowRunStatusIcon status={run.snapshot.status} />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-0">
                          <span className="block w-full min-w-0 truncate text-xs">
                            {formatRunTitle(run.snapshot, run.runId)}
                          </span>
                          <span className="text-neutral3 flex w-full min-w-0 items-center gap-1 text-xs">
                            <span className="shrink-0">#{run.runId.slice(0, 6)}</span>
                            {run?.snapshot && typeof run.snapshot === 'object' && run.snapshot.timestamp && (
                              <>
                                <span className="shrink-0">·</span>
                                <span className="truncate">
                                  {formatDate(run.snapshot.timestamp, 'MMM d, yyyy h:mm a')}
                                </span>
                              </>
                            )}
                          </span>
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
          </CollapsibleContent>
        </Collapsible>
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
