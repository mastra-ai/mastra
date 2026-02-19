import * as React from 'react';

export interface WorkspaceContextValue {
  workspaceId?: string;
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children, value }: { children: React.ReactNode; value: WorkspaceContextValue }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within a <Workspace> component');
  }
  return ctx;
}
