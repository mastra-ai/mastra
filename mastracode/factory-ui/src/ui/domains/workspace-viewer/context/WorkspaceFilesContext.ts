import { createContext } from 'react';

export interface WorkspaceFilesApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  viewingFile: boolean;
  setViewingFile: (viewing: boolean) => void;
  canDock: boolean;
}

export const WorkspaceFilesContext = createContext<WorkspaceFilesApi | undefined>(undefined);
