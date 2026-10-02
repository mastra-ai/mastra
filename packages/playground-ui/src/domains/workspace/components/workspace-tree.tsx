import type { WorkspaceFsListResponse } from '@mastra/client-js';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlertIcon, FolderPlusIcon, LockIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useWorkspaceDirectory } from '../hooks/use-workspace-directory';
import { ROOT_PATH, joinPath, parentOf } from '../path';
import { MountIcon } from './mount-icon';
import type { WorkspaceMount } from './mount-icon';
import { useWorkspaceContext } from './use-workspace-context';
import type { WorkspaceEntryRef } from './use-workspace-context';
import { WorkspaceError } from './workspace-error';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Spinner } from '@/ds/components/Spinner';
import { Tree } from '@/ds/components/Tree';
import { Txt } from '@/ds/components/Txt';
import { FileIcon, FolderIcon, TrashIcon } from '@/ds/icons';

const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1) : 0;
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
};

type RequestDelete = (entry: WorkspaceEntryRef) => void;

export function WorkspaceTree() {
  const { workspaceId, activeFilePath, setActiveFilePath } = useWorkspaceContext();
  const { data, isLoading, error } = useWorkspaceDirectory(workspaceId, ROOT_PATH);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceEntryRef | null>(null);

  if (isLoading) return <TreeSkeleton />;
  // A failed background refetch keeps showing the last listing.
  if (!data) return <WorkspaceError error={error} fallback="Could not load files." className="m-2" />;

  return (
    <>
      <Tree aria-label="Workspace files" selectedId={activeFilePath} onSelect={setActiveFilePath} className="py-1">
        <Entries entries={data} parent={ROOT_PATH} onRequestDelete={setPendingDelete} />
      </Tree>
      <DeleteDialog entry={pendingDelete} onClose={() => setPendingDelete(null)} />
    </>
  );
}

function Entries({
  entries,
  parent,
  onRequestDelete,
}: {
  entries: WorkspaceFsListResponse['entries'];
  parent: string;
  onRequestDelete: RequestDelete;
}) {
  return entries.map(entry => {
    const path = joinPath(parent, entry.name);
    return entry.type === 'directory' ? (
      <FolderNode
        key={entry.name}
        name={entry.name}
        path={path}
        mount={entry.mount}
        onRequestDelete={onRequestDelete}
      />
    ) : (
      <FileNode key={entry.name} name={entry.name} size={entry.size} path={path} onRequestDelete={onRequestDelete} />
    );
  });
}

/** Trailing row details, revealed on hover or keyboard focus. */
function RowActions({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </span>
  );
}

function DeleteButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Button
      variant="destructive-ghost"
      size="icon-sm"
      tooltip={`Delete ${name}`}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={event => event.stopPropagation()}
    >
      <TrashIcon />
    </Button>
  );
}

interface NodeProps {
  name: string;
  path: string;
  onRequestDelete: RequestDelete;
}

function FolderNode({ name, path, mount, onRequestDelete }: NodeProps & { mount?: WorkspaceMount }) {
  const { workspaceId, onDelete, onCreateDirectory, isReadOnly, openFolders, setFolderOpen } = useWorkspaceContext();
  const open = openFolders.has(path);
  // Shares the query with FolderChildren; only used to flag the first load next to the name.
  const { isLoading } = useWorkspaceDirectory(workspaceId, path, { enabled: open });
  const [creating, setCreating] = useState(false);
  const canDelete = onDelete && !isReadOnly(path);
  const canCreate = onCreateDirectory && !isReadOnly(path);

  return (
    <Tree.Folder id={path} open={open} onOpenChange={next => setFolderOpen(path, next)}>
      <Tree.FolderTrigger
        actions={
          canDelete || canCreate ? (
            <RowActions>
              {canCreate ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  tooltip={`New folder in ${name}`}
                  onClick={event => {
                    event.stopPropagation();
                    setFolderOpen(path, true);
                    setCreating(true);
                  }}
                  onKeyDown={event => event.stopPropagation()}
                >
                  <FolderPlusIcon />
                </Button>
              ) : null}
              {canDelete ? (
                <DeleteButton name={name} onClick={() => onRequestDelete({ path, type: 'directory' })} />
              ) : null}
            </RowActions>
          ) : undefined
        }
      >
        <Tree.Icon>
          {mount ? (
            <span
              role="img"
              aria-label={`Mount: ${mount.displayName ?? mount.provider}`}
              title={[mount.displayName ?? mount.provider, mount.description].filter(Boolean).join(' — ')}
              className="flex"
            >
              <MountIcon mount={mount} />
            </span>
          ) : (
            <FolderIcon />
          )}
        </Tree.Icon>
        <Tree.Label>{name}</Tree.Label>
        {mount?.status === 'error' ? (
          <span
            role="img"
            aria-label={`Mount error: ${mount.error ?? 'unavailable'}`}
            title={mount.error}
            className="flex shrink-0"
          >
            <CircleAlertIcon className="text-destructive size-3" />
          </span>
        ) : null}
        {mount && isReadOnly(path) ? (
          <span role="img" aria-label="Read-only" title="Read-only" className="flex shrink-0">
            <LockIcon className="size-3 text-muted-foreground" />
          </span>
        ) : null}
        {open && isLoading ? (
          <span className="flex shrink-0 animate-in delay-200 fill-mode-backwards fade-in">
            <Spinner size="sm" aria-label={`Loading ${name}`} className="size-3 text-muted-foreground" />
          </span>
        ) : null}
      </Tree.FolderTrigger>
      <Tree.FolderContent>
        {open ? (
          <FolderChildren
            path={path}
            creating={creating}
            onCreated={() => setCreating(false)}
            onRequestDelete={onRequestDelete}
          />
        ) : null}
      </Tree.FolderContent>
    </Tree.Folder>
  );
}

/** Mounted only once its folder is opened, so unopened folders are never listed. */
function FolderChildren({
  path,
  creating,
  onCreated,
  onRequestDelete,
}: {
  path: string;
  creating: boolean;
  onCreated: () => void;
  onRequestDelete: RequestDelete;
}) {
  const { workspaceId, onCreateDirectory } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useWorkspaceDirectory(workspaceId, path);

  const create = async (name: string) => {
    try {
      await onCreateDirectory?.(joinPath(path, name.replace(/^\/+|\/+$/g, '')));
    } catch {
      // The caller reports the failure; keep the input open so the user can retry or cancel.
      return;
    }
    onCreated();
    await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'fs', 'list', path] });
  };

  return (
    <>
      {creating ? (
        <Tree.Input type="folder" placeholder="Folder name" onSubmit={name => void create(name)} onCancel={onCreated} />
      ) : null}
      {isLoading ? null : data ? (
        <Entries entries={data} parent={path} onRequestDelete={onRequestDelete} />
      ) : (
        <WorkspaceError error={error} fallback="Could not load folder." className="my-1 mr-1" />
      )}
    </>
  );
}

function FileNode({ name, size, path, onRequestDelete }: NodeProps & { size?: number }) {
  const { onDelete, isReadOnly, activeFilePath } = useWorkspaceContext();
  const canDelete = onDelete && !isReadOnly(path);
  const isActive = path === activeFilePath;
  const ref = useRef<HTMLLIElement>(null);

  // Parents load lazily, so the active row may only appear after the selection changed.
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isActive]);

  return (
    <Tree.File ref={ref} id={path}>
      <Tree.Icon>
        <FileIcon />
      </Tree.Icon>
      <Tree.Label>{name}</Tree.Label>
      <RowActions>
        {size !== undefined ? (
          <Txt as="span" variant="caption" tone="faint" font="mono">
            {formatBytes(size)}
          </Txt>
        ) : null}
        {canDelete ? <DeleteButton name={name} onClick={() => onRequestDelete({ path, type: 'file' })} /> : null}
      </RowActions>
    </Tree.File>
  );
}

function DeleteDialog({ entry, onClose }: { entry: WorkspaceEntryRef | null; onClose: () => void }) {
  const { workspaceId, activeFilePath, setActiveFilePath, onDelete } = useWorkspaceContext();
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
      open={entry !== null}
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
          <Button variant="destructive" disabled={isDeleting} onClick={() => void confirm()}>
            {isDeleting ? 'Deleting…' : 'Delete'}
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
