import { createContext } from 'react';
import type { ReactNode } from 'react';

import type { WorkspacePanelSize } from '../layout';

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  size: WorkspacePanelSize;
  setSize: (size: WorkspacePanelSize) => void;
  canDock: boolean;
  /** Whether the overview may read changes without waking an idle sandbox nobody asked for. */
  readsChanges: boolean;
  /** What the page shows above the overview, e.g. the card the session works. */
  summary?: ReactNode;
}

export const WorkspacePanelContext = createContext<WorkspacePanelApi | undefined>(undefined);
