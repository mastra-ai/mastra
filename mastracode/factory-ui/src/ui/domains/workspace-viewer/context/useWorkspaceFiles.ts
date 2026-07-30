import { useContext } from 'react';

import { WorkspaceFilesContext } from './WorkspaceFilesContext';
import type { WorkspaceFilesApi } from './WorkspaceFilesContext';

export function useWorkspaceFiles(): WorkspaceFilesApi {
  const ctx = useContext(WorkspaceFilesContext);
  if (!ctx) throw new Error('useWorkspaceFiles must be used within a WorkspaceFilesContext');
  return ctx;
}
