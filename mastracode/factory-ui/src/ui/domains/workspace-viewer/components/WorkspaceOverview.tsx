import { Button } from '@mastra/playground-ui/components/Button';
import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { FileDiff, MessageSquare, NotepadText } from 'lucide-react';

import type { WorkspaceChanges } from '../../../../api/types';
import { RecreateSandboxAction } from './RecreateSandboxAction';
import type { RecreateSandboxTarget } from './RecreateSandboxAction';
import { WorkspaceOverviewStatus } from './WorkspaceOverviewStatus';
import { Txt } from '@mastra/playground-ui/components/Txt';

interface WorkspaceOverviewProps {
  changes?: WorkspaceChanges;
  changesLoading: boolean;
  changesError?: Error;
  onShowFiles: () => void;
  onShowChanges: () => void;
  /** From the board snapshot the thread already polls; absent when the thread has no work item. */
  commentCount?: number;
  onShowComments?: () => void;
  /** Present only when the server says the viewer may recreate this session's sandbox. */
  recreateSandbox?: RecreateSandboxTarget;
}

function changesSummary(changes: WorkspaceChanges | undefined) {
  if (!changes?.available) return null;
  if (changes.changes.length === 0) return 'No changes';
  return `${changes.changes.length} changed`;
}

function changeStats(changes: WorkspaceChanges | undefined) {
  if (!changes?.available || changes.changes.length === 0) return undefined;
  const { additions, deletions } = changes;
  if (additions === undefined || deletions === undefined) return undefined;
  return { additions, deletions };
}

export function WorkspaceOverview({
  changes,
  changesLoading,
  changesError,
  onShowFiles,
  onShowChanges,
  commentCount,
  onShowComments,
  recreateSandbox,
}: WorkspaceOverviewProps) {
  const stats = changeStats(changes);
  const changesStatus = stats ? (
    <Txt as="span" variant="body-sm">
      <DiffStat {...stats} />
    </Txt>
  ) : (
    <span className="text-muted-foreground">{changesSummary(changes)}</span>
  );

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col gap-0.5 p-1.5" aria-label="Workspace">
      <Button className="w-full justify-start" size="sm" variant="ghost" onClick={onShowChanges}>
        <FileDiff />
        <span>Changes</span>
        <Txt as="span" variant="meta" className="ml-auto">
          <WorkspaceOverviewStatus loading={changesLoading} error={changesError}>
            {changesStatus}
          </WorkspaceOverviewStatus>
        </Txt>
      </Button>
      <Button className="w-full justify-start" size="sm" variant="ghost" onClick={onShowFiles}>
        <NotepadText />
        <span>Files</span>
      </Button>
      {onShowComments ? (
        <Button className="w-full justify-start" size="sm" variant="ghost" onClick={onShowComments}>
          <MessageSquare />
          <span>Comments</span>
          <Txt as="span" variant="meta" tone="muted" className="ml-auto">
            {commentCount === 0 ? 'None yet' : commentCount}
          </Txt>
        </Button>
      ) : null}
      {recreateSandbox ? (
        <RecreateSandboxAction
          target={recreateSandbox}
          changes={changes}
          changesLoading={changesLoading}
          changesError={changesError}
        />
      ) : null}
    </aside>
  );
}
