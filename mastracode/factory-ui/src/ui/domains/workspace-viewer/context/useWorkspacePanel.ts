import { useContext } from 'react';

import { WorkspacePanelContext, WorkspacePanelDockableContext } from './WorkspacePanelContext';
import type { WorkspacePanelApi } from './WorkspacePanelContext';

export function useWorkspacePanel(): WorkspacePanelApi {
  const context = useContext(WorkspacePanelContext);
  if (!context) throw new Error('useWorkspacePanel must be used within a WorkspacePanelContext');
  return context;
}

export function useWorkspacePanelDockable(): boolean {
  const dockable = useContext(WorkspacePanelDockableContext);
  if (dockable === undefined) throw new Error('useWorkspacePanelDockable must be used within a WorkspaceFilesProvider');
  return dockable;
}
