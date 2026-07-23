import { createContext } from 'react';

export interface FactorySessionState {
  factoryProjectId: string;
  projectRepositoryId?: string;
  sandboxId?: string;
  sandboxWorkdir?: string;
}

export interface ChatSessionContextApi {
  resourceId: string;
  sessionEnabled: boolean;
  resourceEnabled: boolean;
  factorySessionState?: FactorySessionState;
  baseUrl: string;
  /**
   * 'factory' — org-scoped session bound to a factory worktree of a GitHub
   * project (runs are driven by the factory; modes are hidden).
   * 'user' — personal session (a `user/` worktree opened via
   * /user/threads/*); modes stay available.
   */
  kind: 'factory' | 'user';
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
