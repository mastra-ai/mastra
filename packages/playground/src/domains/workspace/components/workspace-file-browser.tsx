import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMastraClient } from '@mastra/react';

import { isWorkspaceV1Supported } from '../compatibility';
import {
  useWorkspaceFiles,
  useCreateWorkspaceDirectory,
  useDeleteWorkspaceFile,
} from '../hooks/use-workspace';
import type { FileEntry, FileListResponse } from '../types';
import { FileBrowser } from './file-browser';

export interface WorkspaceFileBrowserProps {
  workspaceId?: string;
  /** When true, create/delete actions are hidden. */
  readOnly?: boolean;
  onFileSelect?: (path: string) => void;
  /**
   * Bump this value to force a full reload of the tree, discarding lazily
   * loaded folder children. Used after external mutations (e.g. installing a
   * skill) so newly created files appear without a manual refresh.
   */
  refreshToken?: number;
}

/**
 * Prefix lazily-loaded child entries with their parent path so the flat tree
 * builder can reconstruct the hierarchy from a single accumulated list.
 */
function withParentPath(parentPath: string, entries: FileEntry[]): FileEntry[] {
  return entries.map(entry => {
    if (entry.name.includes('/')) return entry;
    return { ...entry, name: `${parentPath}/${entry.name}` };
  });
}

/**
 * Workspace-aware file browser that lazily loads folder contents on expand.
 *
 * Owns all workspace data fetching: the root listing is loaded non-recursively
 * and each folder's children are fetched the first time it is opened. The
 * presentational `FileBrowser` renders the accumulated tree.
 */
export function WorkspaceFileBrowser({
  workspaceId,
  readOnly,
  onFileSelect,
  refreshToken,
}: WorkspaceFileBrowserProps) {
  const client = useMastraClient();
  const createDirectory = useCreateWorkspaceDirectory();
  const deleteFile = useDeleteWorkspaceFile();

  // Root level only — children are fetched lazily on folder expand.
  const {
    data: rootData,
    isLoading: isLoadingRoot,
    error: rootError,
    refetch: refetchRoot,
  } = useWorkspaceFiles('.', { recursive: false, workspaceId });

  // Children fetched per folder, keyed by folder path.
  const [folderChildren, setFolderChildren] = useState<Record<string, FileEntry[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<string>>(() => new Set());

  const entries = useMemo<FileEntry[]>(() => {
    const merged: FileEntry[] = [...(rootData?.entries ?? [])];
    for (const children of Object.values(folderChildren)) {
      merged.push(...children);
    }
    return merged;
  }, [rootData, folderChildren]);

  const loadFolder = useCallback(
    async (path: string) => {
      if (!workspaceId || !isWorkspaceV1Supported(client)) return;
      // Already loaded or in flight — nothing to do.
      if (folderChildren[path] || loadingPaths.has(path)) return;

      setLoadingPaths(prev => new Set(prev).add(path));
      try {
        const workspace = (client as any).getWorkspace(workspaceId);
        const result: FileListResponse = await workspace.listFiles(path, false);
        setFolderChildren(prev => ({ ...prev, [path]: withParentPath(path, result.entries) }));
      } finally {
        setLoadingPaths(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [client, workspaceId, folderChildren, loadingPaths],
  );

  const handleRefresh = useCallback(() => {
    setFolderChildren({});
    void refetchRoot();
  }, [refetchRoot]);

  // When an external mutation bumps refreshToken, discard lazily loaded folder
  // children and reload the root so newly created files appear.
  const prevRefreshToken = useRef(refreshToken);
  useEffect(() => {
    if (prevRefreshToken.current === refreshToken) return;
    prevRefreshToken.current = refreshToken;
    setFolderChildren({});
    void refetchRoot();
  }, [refreshToken, refetchRoot]);

  // After a write/delete, drop the affected folder's cached children so it
  // re-fetches on next open; refresh the root listing for top-level changes.
  const invalidatePath = useCallback(
    (path: string) => {
      const parent = path.split('/').slice(0, -1).join('/');
      if (!parent) {
        void refetchRoot();
        return;
      }
      setFolderChildren(prev => {
        if (!(parent in prev)) return prev;
        const next = { ...prev };
        delete next[parent];
        return next;
      });
    },
    [refetchRoot],
  );

  const handleCreateDirectory = useCallback(
    (path: string) => {
      createDirectory.mutate({ path, workspaceId }, { onSuccess: () => invalidatePath(path) });
    },
    [createDirectory, workspaceId, invalidatePath],
  );

  const handleDelete = useCallback(
    (path: string) => {
      deleteFile.mutate(
        { path, recursive: true, force: true, workspaceId },
        { onSuccess: () => invalidatePath(path) },
      );
    },
    [deleteFile, workspaceId, invalidatePath],
  );

  return (
    <FileBrowser
      entries={entries}
      currentPath="."
      isLoading={isLoadingRoot}
      error={rootError instanceof Error ? rootError : null}
      onNavigate={() => undefined}
      onFileSelect={onFileSelect}
      onRefresh={handleRefresh}
      onLoadFolder={path => void loadFolder(path)}
      loadingPaths={loadingPaths}
      onCreateDirectory={readOnly ? undefined : handleCreateDirectory}
      isCreatingDirectory={createDirectory.isPending}
      onDelete={readOnly ? undefined : handleDelete}
      isDeleting={deleteFile.isPending}
    />
  );
}
