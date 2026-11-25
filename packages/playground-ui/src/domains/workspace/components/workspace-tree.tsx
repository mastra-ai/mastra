import { useWorkspaceDirectories, useWorkspaceDirectory } from '@mastra/react/hooks/workspace';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ROOT_PATH, ancestorsOf, parentOf } from '../path';
import { useWorkspaceContext } from './use-workspace-context';
import type { WorkspaceEntryRef } from './use-workspace-context';
import { WorkspaceError } from './workspace-error';
import { describeWorkspaceError } from './workspace-error-message';
import { WorkspaceNewFolderInput } from './workspace-new-folder-input';
import { FileRow } from './workspace-tree-file-row';
import { FolderRow } from './workspace-tree-folder-row';
import type { WorkspaceTreeRowActions } from './workspace-tree-row-actions';
import { buildWorkspaceTreeRows } from './workspace-tree-rows';
import type { WorkspaceFolderListing } from './workspace-tree-rows';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button/Button';
import { Skeleton } from '@/ds/components/Skeleton/skeleton';
import { Txt } from '@/ds/components/Txt/Txt';
import { VirtualTree } from '@/ds/components/VirtualTree/virtual-tree';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';

const PENDING_LISTING: WorkspaceFolderListing = { isLoading: true };

export function WorkspaceTree() {
  const { workspaceId, activeFilePath, setActiveFilePath, openFolders, setFolderOpen } = useWorkspaceContext();
  const { data, isLoading, error } = useWorkspaceDirectory({ workspaceId: workspaceId, path: ROOT_PATH });
  const openPaths = [...openFolders].filter(path => ancestorsOf(path).every(folder => openFolders.has(folder)));
  const results = useWorkspaceDirectories({ workspaceId, paths: openPaths });
  const [creatingIn, setCreatingIn] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<WorkspaceEntryRef>();

  if (isLoading) return <TreeSkeleton />;
  // A failed background refetch keeps showing the last listing.
  if (!data) return <WorkspaceError error={error ?? undefined} fallback="Could not load files." className="m-2" />;

  const listings = new Map(
    openPaths.map((path, index): [string, WorkspaceFolderListing] => {
      const result = results[index];
      return [
        path,
        result ? { data: result.data, error: result.error ?? undefined, isLoading: result.isLoading } : PENDING_LISTING,
      ];
    }),
  );
  const rows = buildWorkspaceTreeRows(data, ROOT_PATH, { open: openFolders, listings, creatingIn });
  const rowActions: WorkspaceTreeRowActions = {
    onRequestDelete: setPendingDelete,
    onRequestCreate: path => {
      setFolderOpen(path, true);
      setCreatingIn(path);
    },
  };

  return (
    <>
      <VirtualTree
        aria-label="Workspace files"
        rows={rows}
        selectedId={activeFilePath}
        onActivate={row => {
          if (row.kind !== 'entry') return;
          if (row.expanded === undefined) setActiveFilePath(row.path);
          else setFolderOpen(row.path, !row.expanded);
        }}
        onExpandedChange={(row, expanded) => {
          if (row.kind === 'entry') setFolderOpen(row.path, expanded);
        }}
        renderRow={row => {
          if (row.kind === 'input') {
            return <WorkspaceNewFolderInput parent={row.parent} onDone={() => setCreatingIn(undefined)} />;
          }
          if (row.kind === 'error') {
            return (
              <>
                <IconExclamationCircle className="size-icon-xs shrink-0 text-destructive-foreground" />
                <Txt as="span" variant="caption" tone="muted" className="truncate">
                  {describeWorkspaceError(row.error, 'Could not load folder.')}
                </Txt>
              </>
            );
          }
          return row.entry.type === 'directory' ? (
            <FolderRow row={row} actions={rowActions} />
          ) : (
            <FileRow row={row} actions={rowActions} />
          );
        }}
      />
      <DeleteDialog entry={pendingDelete} onClose={() => setPendingDelete(undefined)} />
    </>
  );
}

function DeleteDialog({ entry, onClose }: { entry?: WorkspaceEntryRef; onClose: () => void }) {
  const { workspaceId, activeFilePath, setActiveFilePath, onDelete, setFolderOpen } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const name = entry?.path.split('/').pop();

  const confirm = async () => {
    if (!entry || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entry);
    } catch {
      // The caller reports the failure; keep the dialog open so the user can retry or cancel.
      return;
    } finally {
      setIsDeleting(false);
    }
    if (activeFilePath === entry.path || activeFilePath?.startsWith(`${entry.path}/`)) setActiveFilePath(undefined);
    if (entry.type === 'directory') setFolderOpen(entry.path, false);
    queryClient.removeQueries({ queryKey: ['workspace', workspaceId, 'fs', 'list', entry.path] });
    await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'fs', 'list', parentOf(entry.path)] });
    onClose();
  };

  let description: ReactNode = null;
  if (entry) {
    description =
      entry.type === 'directory'
        ? `This permanently deletes the folder "${name}" and everything inside it.`
        : `This permanently deletes "${name}".`;
  }

  return (
    <AlertDialog
      open={entry !== undefined}
      onOpenChange={open => {
        if (!open && !isDeleting) onClose();
      }}
    >
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete {entry?.type === 'directory' ? 'folder' : 'file'}?</AlertDialog.Title>
          <AlertDialog.Description>{description} This action cannot be undone.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
          <Button variant="destructive" onClick={() => void confirm()} loading={isDeleting}>
            Delete
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}

function TreeSkeleton() {
  return (
    <div data-testid="workspace-tree-skeleton" aria-busy="true" className="flex flex-col gap-2 py-2 pl-[18px]">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
