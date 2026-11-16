import { createContext } from 'react';
import type { ReactNode } from 'react';

import type { RepositoryProvider } from '../components/changes/tree/change-tree';

export interface WorkspaceSectionSlots {
  repository?: { slug: string; provider: RepositoryProvider };
  changeRequest?: ReactNode;
}

export interface WorkspacePanelPage {
  subject: (lead: ReactNode | undefined) => ReactNode;
  overview: (workspace: (slots?: WorkspaceSectionSlots) => ReactNode) => ReactNode;
}

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  threadId?: string;
  canDock: boolean;
  docked: boolean;
  hasDocked: boolean;
  /** Whether the overview may read changes without waking an idle sandbox nobody asked for. */
  readsChanges: boolean;
  page?: WorkspacePanelPage;
}

export const WorkspacePanelContext = createContext<WorkspacePanelApi | undefined>(undefined);

export function workspacePanelKey({ workspacePath, threadId }: Pick<WorkspacePanelApi, 'workspacePath' | 'threadId'>) {
  return `${workspacePath}|${threadId}`;
}
