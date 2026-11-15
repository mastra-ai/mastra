import { createContext } from 'react';
import type { ReactNode } from 'react';

export interface WorkspacePanelPage {
  subject: (lead: ReactNode | undefined) => ReactNode;
  overview: (workspace: (changeRequest?: ReactNode) => ReactNode) => ReactNode;
}

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  canDock: boolean;
  moving: boolean;
  onDockSettled: () => void;
  /** Whether the overview may read changes without waking an idle sandbox nobody asked for. */
  readsChanges: boolean;
  page?: WorkspacePanelPage;
}

export const WorkspacePanelContext = createContext<WorkspacePanelApi | undefined>(undefined);

/** Apart from the panel state so the page frame skips toggles; also true while an outgrown card folds back. */
export const WorkspacePanelDockableContext = createContext<boolean | undefined>(undefined);

export function workspacePanelKey({ workspacePath, threadId }: Pick<WorkspacePanelApi, 'workspacePath' | 'threadId'>) {
  return `${workspacePath}|${threadId}`;
}
