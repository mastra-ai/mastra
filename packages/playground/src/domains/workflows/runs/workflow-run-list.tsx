import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
} from '@mastra/playground-ui/components/ThreadList';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { formatDate } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import { getRunTimestamp } from '../utils';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowRecentRunsProps {
  workflowId: string;
  runId?: string;
}

function formatRunInput(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object' || !('context' in snapshot)) {
    return null;
  }
  const { context } = snapshot;
  if (!context || typeof context !== 'object' || !('input' in context)) {
    return null;
  }
  const { input } = context;
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === 'string') {
    return input;
  }

  const inputValue = typeof input === 'object' && input !== null && 'output' in input ? input.output : input;

  try {
    return JSON.stringify(inputValue);
  } catch {
    return null;
  }
}

export const WorkflowRecentRuns = ({ workflowId, runId }: WorkflowRecentRunsProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  const canDeleteRun = canDelete('workflows');

  const { Link, paths, navigate } = useLinkComponent();
  const {
    isLoading,
    error,
    data: runs,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useWorkflowRuns(workflowId);
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

  const runList = runs || [];

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex min-h-0 flex-col">
        <CollapsibleTrigger className="text-ui-sm text-neutral4 flex shrink-0 items-center gap-2 px-4 py-3 text-left">
          <ChevronRight aria-hidden className="text-neutral3 size-4 shrink-0 motion-reduce:transition-none" />
          <span>Recent runs</span>
          {!isLoading && !error && (
            <span className="text-ui-xs text-neutral3">
              {runList.length}
              {hasNextPage ? '+' : ''}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted fill className="flex min-h-0 flex-col">
          <ScrollArea className="min-h-0 w-full flex-1" mask={{ top: false }}>
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-32" />
              </div>
            ) : (
              <ThreadList aria-label="Workflow runs" embedded>
                {runList.length === 0 ? (
                  <ThreadListEmpty>
                    {error
                      ? 'Unable to load workflow runs.'
                      : 'Your run history will appear here once you run the workflow'}
                  </ThreadListEmpty>
                ) : (
                  <ThreadListItems>
                    {runList.map(run => {
                      const isActiveRun = run.runId === runId;
                      const runInput = isActiveRun ? formatRunInput(run.snapshot) : null;
                      const runTimestamp =
                        run?.snapshot && typeof run.snapshot === 'object'
                          ? getRunTimestamp(run.snapshot.timestamp)
                          : undefined;

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
                              <span className="text-ui-sm flex w-full min-w-0 items-center gap-2">
                                <span className="text-neutral5 min-w-0 flex-1 truncate font-medium" title={run.runId}>
                                  {run.runId}
                                </span>
                              </span>
                              {runTimestamp !== undefined && (
                                <time
                                  className="text-neutral3 text-ui-xs"
                                  dateTime={new Date(runTimestamp).toISOString()}
                                >
                                  {formatDate(runTimestamp, 'MMM d, yyyy · h:mm a')}
                                </time>
                              )}
                              {runInput && (
                                <span className="text-neutral3 text-ui-sm block w-full min-w-0 truncate">
                                  {runInput}
                                </span>
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
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

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
  onOpenChange: (open: boolean) => void;
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
