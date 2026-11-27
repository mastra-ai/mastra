import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconFolderLink } from '@mastra/playground-ui/icons/central/IconFolderLink';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { WorkspaceTreeEntry } from '../../../../../api/types';
import { CHANGE_STATUSES } from '../changes/change-statuses';
import { ChangeStatusLetter } from '../changes/ChangeStatusLetter';
import type { ChangeMarks } from './change-marks';
import { getFileIcon, getFolderIcon } from './file-icons';

/** `→ target` after a symlink's name. */
function LinkTarget({ target }: { target?: string }) {
  if (!target) return null;
  return (
    <Txt as="span" variant="caption" tone="muted" className="ml-1.5 truncate">
      → {target}
    </Txt>
  );
}

export function BrowserEntryContent({
  entry,
  expanded,
  marks,
}: {
  entry: WorkspaceTreeEntry;
  expanded?: boolean;
  marks: ChangeMarks;
}) {
  if (entry.type === 'directory' && entry.linkedPath !== undefined) {
    return (
      <>
        <Tree.Icon>
          <IconFolderLink className="text-badge-amber-indicator" />
        </Tree.Icon>
        <Tree.Label>
          {entry.name}
          <LinkTarget target={entry.symlinkTarget} />
        </Tree.Label>
      </>
    );
  }
  if (entry.type === 'directory') {
    return (
      <>
        <Tree.Icon>{getFolderIcon(expanded ?? false)}</Tree.Icon>
        <Tree.Label>{entry.name}</Tree.Label>
        {marks.folders.has(entry.path) ? (
          <span
            role="img"
            aria-label="Holds branch changes"
            title="Holds branch changes"
            className={cn(
              'mr-1.5 ml-auto size-1.5 shrink-0 rounded-full bg-current',
              CHANGE_STATUSES.modified.className,
            )}
          />
        ) : null}
      </>
    );
  }
  const status = marks.files.get(entry.path);
  return (
    <>
      <Tree.Icon>{getFileIcon(entry.name)}</Tree.Icon>
      <Tree.Label>
        {entry.name}
        <LinkTarget target={entry.symlinkTarget} />
      </Tree.Label>
      {status ? <ChangeStatusLetter status={status} /> : null}
    </>
  );
}
