import { MountIcon } from './mount-icon';
import { useWorkspaceContext } from './use-workspace-context';
import type { WorkspaceTreeRowActions } from './workspace-tree-row-actions';
import { DeleteButton, RowActions } from './workspace-tree-row-actions';
import type { WorkspaceEntryRow } from './workspace-tree-rows';
import { Button } from '@/ds/components/Button/Button';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { TreeIcon } from '@/ds/components/Tree/tree-icon';
import { TreeLabel } from '@/ds/components/Tree/tree-label';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconFolderAddRight } from '@/ds/icons/central/IconFolderAddRight';
import { IconLock } from '@/ds/icons/central/IconLock';
import { FolderIcon } from '@/ds/icons/FolderIcon';

export function FolderRow({ row, actions }: { row: WorkspaceEntryRow; actions: WorkspaceTreeRowActions }) {
  const { onDelete, onCreateDirectory, isReadOnly } = useWorkspaceContext();
  const { name, mount } = row.entry;
  const canDelete = onDelete && !isReadOnly(row.path);
  const canCreate = onCreateDirectory && !isReadOnly(row.path);

  return (
    <>
      <TreeIcon>
        {mount ? (
          <span
            role="img"
            aria-label={`Mount: ${mount.displayName ?? mount.provider}`}
            title={[mount.displayName ?? mount.provider, mount.description].filter(Boolean).join(': ')}
            className="flex"
          >
            <MountIcon mount={mount} />
          </span>
        ) : (
          <FolderIcon />
        )}
      </TreeIcon>
      <TreeLabel>{name}</TreeLabel>
      {mount?.status === 'error' ? (
        <span
          role="img"
          aria-label={`Mount error: ${mount.error ?? 'unavailable'}`}
          title={mount.error}
          className="flex shrink-0"
        >
          <IconExclamationCircle className="size-icon-xs text-destructive-foreground" />
        </span>
      ) : null}
      {mount && isReadOnly(row.path) ? (
        <span role="img" aria-label="Read-only" title="Read-only" className="flex shrink-0">
          <IconLock className="size-icon-xs text-muted-foreground" />
        </span>
      ) : null}
      {row.loading ? (
        <span className="flex shrink-0 animate-in delay-200 fill-mode-backwards fade-in">
          <Spinner size="sm" aria-label={`Loading ${name}`} className="size-3 text-muted-foreground" />
        </span>
      ) : null}
      {canDelete || canCreate ? (
        <RowActions>
          {canCreate ? (
            <Button
              variant="ghost"
              size="icon-sm"
              tooltip={`New folder in ${name}`}
              onClick={event => {
                event.stopPropagation();
                actions.onRequestCreate(row.path);
              }}
              onKeyDown={event => event.stopPropagation()}
            >
              <IconFolderAddRight />
            </Button>
          ) : null}
          {canDelete ? (
            <DeleteButton name={name} onClick={() => actions.onRequestDelete({ path: row.path, type: 'directory' })} />
          ) : null}
        </RowActions>
      ) : null}
    </>
  );
}
