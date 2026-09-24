import type { MastraClient } from '@mastra/client-js';
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
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import { getRunResourceId, getRunTimestamp } from '../utils';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useDeleteWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowRecentRunsProps {
  workflowId: string;
  runId?: string;
}

const runSnapshotSchema = z.object({
  status: z.enum(['running', 'failed', 'canceled', 'pending', 'waiting', 'paused', 'suspended', 'success']),
  timestamp: z.number().optional(),
  context: z.object({ input: z.unknown() }),
});
const wrappedRunInputSchema = z.object({ output: z.unknown() });
type RunSnapshot = z.infer<typeof runSnapshotSchema>;
type WorkflowRuns = Awaited<ReturnType<ReturnType<MastraClient['getWorkflow']>['runs']>>;
type WorkflowRunSnapshot = WorkflowRuns['runs'][number]['snapshot'];

function parseRunSnapshot(snapshot: WorkflowRunSnapshot): RunSnapshot | undefined {
  const result = runSnapshotSchema.safeParse(snapshot);
  return result.success ? result.data : undefined;
}

function formatRunInput(snapshot: RunSnapshot | undefined): string | null {
  if (!snapshot || snapshot.context.input == null) return null;

  const input = snapshot.context.input;
  const parsedString = z.string().safeParse(input);
  if (parsedString.success) return parsedString.data;

  const parsedWrappedInput = wrappedRunInputSchema.safeParse(input);
  const inputValue = parsedWrappedInput.success ? parsedWrappedInput.data.output : input;

  try {
    return JSON.stringify(inputValue);
  } catch {
    return null;
  }
}

function WorkflowRunMeta({ timestamp, resourceId }: { timestamp?: number; resourceId?: string }) {
  if (timestamp === undefined && !resourceId) return null;

  return (
    <span className="flex w-full min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
      {timestamp !== undefined && (
        <time className="shrink-0" dateTime={new Date(timestamp).toISOString()}>
          {formatDate(timestamp, 'date-time')}
        </time>
      )}
      {resourceId && (
        <span className="min-w-0 truncate" title={`Resource ${resourceId}`}>
          {timestamp === undefined ? resourceId : `· ${resourceId}`}
        </span>
      )}
    </span>
  );
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
        <CollapsibleTrigger className="flex shrink-0 items-center gap-2 px-4 py-3 text-left text-caption text-muted-foreground">
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground motion-reduce:transition-none" />
          <span>Recent runs</span>
          {!isLoading && !error && (
            <span className="text-meta text-muted-foreground">
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
                      const snapshot = parseRunSnapshot(run.snapshot);
                      const runInput = isActiveRun ? formatRunInput(snapshot) : null;

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
                            {snapshot && (
                              <span className="shrink-0">
                                <WorkflowRunStatusIcon status={snapshot.status} />
                              </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                              <span className="flex w-full min-w-0 items-center gap-2 text-caption">
                                <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={run.runId}>
                                  {run.runId}
                                </span>
                              </span>
                              <WorkflowRunMeta
                                timestamp={getRunTimestamp(snapshot?.timestamp)}
                                resourceId={getRunResourceId(run)}
                              />
                              {runInput && (
                                <span className="block w-full min-w-0 truncate text-caption text-muted-foreground">
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
