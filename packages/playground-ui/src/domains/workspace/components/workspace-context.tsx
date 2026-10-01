import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WorkspaceContext } from './use-workspace-context';
import type { WorkspaceCreateDirectoryHandler, WorkspaceDeleteHandler } from './use-workspace-context';

export interface WorkspaceProviderProps {
  workspaceId: string;
  /** The open file. The component is controlled: the parent owns this value. */
  activeFilePath?: string;
  /** Called when the user opens (or a delete closes) a file; update `activeFilePath` in response. */
  onActiveFileChange: (path: string | undefined) => void;
  /** Enables the delete action on tree rows. */
  onDelete?: WorkspaceDeleteHandler;
  /** Enables the "New folder" action. */
  onCreateDirectory?: WorkspaceCreateDirectoryHandler;
  /** Folders (and their contents) where delete / new folder are hidden. */
  readOnlyPaths?: string[];
  /** Include file search. Defaults to true. */
  searchFiles?: boolean;
  /** Include skill search. Defaults to true. */
  searchSkills?: boolean;
  children: ReactNode;
}

export function WorkspaceProvider({
  workspaceId,
  activeFilePath,
  onDelete,
  onCreateDirectory,
  onActiveFileChange,
  readOnlyPaths,
  searchFiles = true,
  searchSkills = true,
  children,
}: WorkspaceProviderProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const readOnlyKey = readOnlyPaths?.join('\n') ?? '';

  const value = useMemo(
    () => ({
      workspaceId,
      activeFilePath,
      setActiveFilePath: onActiveFileChange,
      isSearching,
      // Closing the search drops the query so the tree comes back as it was.
      setSearching: (searching: boolean) => {
        setIsSearching(searching);
        if (!searching) setQuery('');
      },
      query,
      setQuery,
      onDelete,
      onCreateDirectory,
      isReadOnly: (path: string) => {
        const roots = readOnlyKey ? readOnlyKey.split('\n') : [];
        return roots.some(root => root === '.' || path === root || path.startsWith(`${root}/`));
      },
      searchFiles,
      searchSkills,
    }),
    [
      workspaceId,
      activeFilePath,
      isSearching,
      query,
      onDelete,
      onCreateDirectory,
      onActiveFileChange,
      readOnlyKey,
      searchFiles,
      searchSkills,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
