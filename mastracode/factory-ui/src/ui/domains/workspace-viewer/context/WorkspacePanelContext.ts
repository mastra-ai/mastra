import { createContext } from 'react';

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  canDock: boolean;
}

export const WorkspacePanelContext = createContext<WorkspacePanelApi | undefined>(undefined);
