import { Button } from '@mastra/playground-ui/components/Button';
import { FileDiff, NotepadText } from 'lucide-react';

import type { WorkspaceChanges, WorkspaceFilesListing } from '../../../../api/types';
import { WorkspaceOverviewStatus } from './WorkspaceOverviewStatus';

interface WorkspaceOverviewProps {
  listing?: WorkspaceFilesListing;
  changes?: WorkspaceChanges;
  filesLoading: boolean;
  changesLoading: boolean;
  filesError?: Error;
  changesError?: Error;
  onShowFiles: () => void;
  onShowChanges: () => void;
}

function fileSummary(count: number) {
  if (count === 0) return 'No files';
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

function changesSummary(changes: WorkspaceChanges | undefined) {
  if (!changes?.available) return 'No sandbox';
  if (changes.changes.length === 0) return 'No changes';
  return `${changes.changes.length} changed`;
}

export function WorkspaceOverview({
  listing,
  changes,
  filesLoading,
  changesLoading,
  filesError,
  changesError,
  onShowFiles,
  onShowChanges,
}: WorkspaceOverviewProps) {
  const fileCount = listing?.files.length ?? 0;
  const changeCount = changes?.changes.length ?? 0;
  const fileLabel = fileSummary(fileCount);
  const changesLabel = changesSummary(changes);
  const hasChangeStats =
    changes?.available === true &&
    changeCount > 0 &&
    changes.additions !== undefined &&
    changes.deletions !== undefined;
  const changesStatus = hasChangeStats ? (
    <span className="flex items-center gap-1 font-mono tabular-nums">
      <span className="text-notice-success/70">+{changes.additions}</span>
      <span className="text-notice-destructive/70">−{changes.deletions}</span>
    </span>
  ) : (
    <span className="text-icon3">{changesLabel}</span>
  );

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col gap-0.5 p-1.5" aria-label="Workspace">
      <Button className="w-full justify-start rounded-lg px-2" size="sm" variant="ghost" onClick={onShowChanges}>
        <FileDiff />
        <span>Changes</span>
        <span className="text-ui-xs ml-auto font-medium">
          <WorkspaceOverviewStatus loading={changesLoading} error={changesError}>
            {changesStatus}
          </WorkspaceOverviewStatus>
        </span>
      </Button>
      <Button className="w-full justify-start rounded-lg px-2" size="sm" variant="ghost" onClick={onShowFiles}>
        <NotepadText />
        <span>Files</span>
        <span className="text-ui-xs ml-auto font-medium">
          <WorkspaceOverviewStatus loading={filesLoading} error={filesError}>
            <span className="text-icon3">{fileLabel}</span>
          </WorkspaceOverviewStatus>
        </span>
      </Button>
    </aside>
  );
}
