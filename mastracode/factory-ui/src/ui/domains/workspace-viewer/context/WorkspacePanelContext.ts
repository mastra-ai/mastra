import type { PullRequestStatus } from '@mastra/factory/work-items/change-requests';
import { createContext } from 'react';
import type { ReactNode } from 'react';

import type { RepositoryProvider } from '../components/changes/tree/change-tree';

/** The pull request the branch opened: drawn on the line where the branch meets its base. */
export interface WorkspaceChangeRequest {
  badge: ReactNode;
  status: PullRequestStatus | undefined;
}

export interface WorkspaceSectionSlots {
  repository?: { slug: string; provider: RepositoryProvider };
  changeRequest?: WorkspaceChangeRequest;
}

export type WorkspaceSlot = (slots?: WorkspaceSectionSlots) => ReactNode;

export interface WorkspacePanelPage {
  subject: (lead: ReactNode | undefined) => ReactNode;
  overview: (workspace: WorkspaceSlot | undefined) => ReactNode;
}

export interface WorkspacePanelApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  hasContent: boolean;
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
