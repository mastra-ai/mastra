import { createContext, useContext } from 'react';

export interface WorkspaceContextValue {
  workspaceId: string;
  activeFilePath: string | null;
  setActiveFilePath: (path: string) => void;
  query: string;
  setQuery: (query: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace components must be rendered inside <Workspace.Root>');
  return context;
}
