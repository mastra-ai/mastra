import { createContext } from 'react';

import type { WorkspacePanelSize } from '../layout';

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  size: WorkspacePanelSize;
  setSize: (size: WorkspacePanelSize) => void;
  canDock: boolean;
}

export const WorkspacePanelContext = createContext<WorkspacePanelApi | undefined>(undefined);
