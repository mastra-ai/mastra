import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WorkspaceContext } from './use-workspace-context';
import type {
  WorkspaceCreateDirectoryHandler,
  WorkspaceDeleteHandler,
  WorkspaceSkillRef,
} from './use-workspace-context';

export interface WorkspaceProviderProps {
  workspaceId: string;
  /** Seeds the active file on mount; later changes do not override the user's selection. */
  initialFile?: string;
  /** Enables the delete action on tree rows. */
  onDelete?: WorkspaceDeleteHandler;
  /** Enables the "New folder" action. */
  onCreateDirectory?: WorkspaceCreateDirectoryHandler;
  /** Called whenever the user opens another file (e.g. to sync the URL). */
  onActiveFileChange?: (path: string | null) => void;
  /** Skill search hits go here instead of opening in the viewer. */
  onSkillSelect?: (skill: WorkspaceSkillRef) => void;
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
  initialFile,
  onDelete,
  onCreateDirectory,
  onActiveFileChange,
  onSkillSelect,
  readOnlyPaths,
  searchFiles = true,
  searchSkills = true,
  children,
}: WorkspaceProviderProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(initialFile ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const readOnlyKey = readOnlyPaths?.join('\n') ?? '';

  const value = useMemo(
    () => ({
      workspaceId,
      activeFilePath,
      setActiveFilePath: (path: string | null) => {
        setActiveFilePath(path);
        onActiveFileChange?.(path);
      },
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
      onSkillSelect,
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
      onSkillSelect,
      readOnlyKey,
      searchFiles,
      searchSkills,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
