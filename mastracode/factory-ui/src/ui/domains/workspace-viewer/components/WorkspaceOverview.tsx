import { Button } from '@mastra/playground-ui/components/Button';
import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { FileDiff, NotepadText } from 'lucide-react';
import type { ReactNode } from 'react';

import type { WorkspaceChanges } from '../../../../api/types';
import { RecreateSandboxAction } from './RecreateSandboxAction';
import type { RecreateSandboxTarget } from './RecreateSandboxAction';
import { WorkspaceOverviewStatus } from './WorkspaceOverviewStatus';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { overviewScrollClass } from '../layout';

interface WorkspaceOverviewProps {
  changes?: WorkspaceChanges;
  changesLoading: boolean;
  changesError?: Error;
  onShowFiles: () => void;
  onShowChanges: () => void;
  /** Present only when the server says the viewer may recreate this session's sandbox. */
  recreateSandbox?: RecreateSandboxTarget;
  summary?: ReactNode;
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
  recreateSandbox,
  summary,
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
    <div className={overviewScrollClass}>
      {summary}
      <aside className="flex min-w-0 shrink-0 flex-col gap-0.5 p-1.5" aria-label="Workspace">
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
        {recreateSandbox ? (
          <RecreateSandboxAction
            target={recreateSandbox}
            changes={changes}
            changesLoading={changesLoading}
            changesError={changesError}
          />
        ) : null}
      </aside>
    </div>
  );
}
