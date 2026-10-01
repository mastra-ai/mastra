import { createContext, useContext } from 'react';

export interface WorkspaceEntryRef {
  path: string;
  type: 'file' | 'directory';
}

/** Called after the user confirms a deletion. For directories, delete recursively. */
export type WorkspaceDeleteHandler = (entry: WorkspaceEntryRef) => void | Promise<void>;

/** Called with the workspace-relative path of the directory to create. */
export type WorkspaceCreateDirectoryHandler = (path: string) => void | Promise<void>;

export interface WorkspaceContextValue {
  workspaceId: string;
  activeFilePath?: string;
  setActiveFilePath: (path: string | undefined) => void;
  isSearching: boolean;
  setSearching: (searching: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  onDelete?: WorkspaceDeleteHandler;
  onCreateDirectory?: WorkspaceCreateDirectoryHandler;
  /** Whether a path is (inside) a read-only folder. */
  isReadOnly: (path: string) => boolean;
  searchFiles: boolean;
  searchSkills: boolean;
  fileCount?: number;
  skillCount?: number;
  /** Expanded folders; the active file's parents are added whenever it changes. */
  openFolders: ReadonlySet<string>;
  setFolderOpen: (path: string, open: boolean) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace components must be rendered inside <Workspace.Root>');
  return context;
}
