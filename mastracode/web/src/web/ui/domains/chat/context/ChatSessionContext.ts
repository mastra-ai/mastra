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
  projectPath?: string;
  factorySessionState?: FactorySessionState;
  baseUrl: string;
  /**
   * 'factory' — org-scoped session bound to a factory worktree of a GitHub
   * project (runs are driven by the factory; modes are hidden).
   * 'user' — personal session (a `user/` worktree opened via
   * /user/threads/*, or a local project chat); modes stay available.
   */
  kind: 'factory' | 'user';
  /** Route prefix this session's threads are addressed under. */
  threadBasePath: '/threads' | '/user/threads';
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
