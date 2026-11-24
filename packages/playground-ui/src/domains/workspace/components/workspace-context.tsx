import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ancestorsOf } from '../path';
import { WorkspaceContext } from './use-workspace-context';
import type { WorkspaceCreateDirectoryHandler, WorkspaceDeleteHandler } from './use-workspace-context';
import type { WorkspaceAddSkillOptions } from './workspace-add-skill';

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
  /** Shown as `N Files` in the aside title. */
  fileCount?: number;
  /** Shown as `N Skills` in the aside title. */
  skillCount?: number;
  /** Enables the "Add skill" action and its skills.sh dialog. Omit to hide it. */
  addSkill?: WorkspaceAddSkillOptions;
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
  fileCount,
  skillCount,
  addSkill,
  children,
}: WorkspaceProviderProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(() => new Set(ancestorsOf(activeFilePath ?? '')));
  const [prevActive, setPrevActive] = useState(activeFilePath);

  // Reveal a newly active file by opening its parents; folders the user opened stay open.
  if (activeFilePath !== prevActive) {
    setPrevActive(activeFilePath);
    const missing = ancestorsOf(activeFilePath ?? '').filter(folder => !openFolders.has(folder));
    if (missing.length > 0) setOpenFolders(new Set([...openFolders, ...missing]));
  }

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
      fileCount,
      skillCount,
      addSkill,
      openFolders,
      setFolderOpen: (path: string, open: boolean) =>
        setOpenFolders(current => {
          if (current.has(path) === open) return current;
          const next = new Set(current);
          if (open) next.add(path);
          else next.delete(path);
          return next;
        }),
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
      fileCount,
      skillCount,
      addSkill,
      openFolders,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
