import { useContext } from 'react';

import { WorkspacePanelContext } from './WorkspacePanelContext';
import type { WorkspacePanelApi } from './WorkspacePanelContext';

export function useWorkspacePanel(): WorkspacePanelApi {
  const context = useContext(WorkspacePanelContext);
  if (!context) throw new Error('useWorkspacePanel must be used within a WorkspacePanelContext');
  return context;
}
