import type { ReactNode } from 'react';

import { WorkspacePanelDock } from '../components/WorkspacePanelDock';
import { useWorkspacePanelDockable } from '../context/useWorkspacePanel';

const dockActions = (actions: ReactNode) => <WorkspacePanelDock>{actions}</WorkspacePanelDock>;

export function useWorkspacePanelDockActions() {
  return useWorkspacePanelDockable() ? dockActions : undefined;
}
