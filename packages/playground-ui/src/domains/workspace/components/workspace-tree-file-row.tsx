import { useWorkspaceContext } from './use-workspace-context';
import type { WorkspaceTreeRowActions } from './workspace-tree-row-actions';
import { DeleteButton, RowActions } from './workspace-tree-row-actions';
import type { WorkspaceEntryRow } from './workspace-tree-rows';
import { TreeIcon } from '@/ds/components/Tree/tree-icon';
import { TreeLabel } from '@/ds/components/Tree/tree-label';
import { Txt } from '@/ds/components/Txt/Txt';
import { FileIcon } from '@/ds/icons/FileIcon';

const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1) : 0;
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
};

export function FileRow({ row, actions }: { row: WorkspaceEntryRow; actions: WorkspaceTreeRowActions }) {
  const { onDelete, isReadOnly } = useWorkspaceContext();
  const { name, size } = row.entry;
  const canDelete = onDelete && !isReadOnly(row.path);

  return (
    <>
      <TreeIcon>
        <FileIcon />
      </TreeIcon>
      <TreeLabel>{name}</TreeLabel>
      <RowActions>
        {size !== undefined ? (
          <Txt as="span" variant="caption" tone="faint" font="mono">
            {formatBytes(size)}
          </Txt>
        ) : null}
        {canDelete ? (
          <DeleteButton name={name} onClick={() => actions.onRequestDelete({ path: row.path, type: 'file' })} />
        ) : null}
      </RowActions>
    </>
  );
}
