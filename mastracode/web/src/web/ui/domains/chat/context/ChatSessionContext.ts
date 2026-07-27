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
  /**
   * Failure while preparing the session's workspace (sandbox provision /
   * repo materialization). While set, the session never becomes enabled, so
   * surfaces must show this error instead of an eternal loading state.
   */
  sessionError?: Error;
  /** Re-runs workspace preparation after a `sessionError`. */
  retrySession?: () => void;
  projectPath?: string;
  /**
   * The session's conventional thread id (=== its sessionId, seeded by
   * FactoryStartCoordinator). Passing it through session creation makes init
   * an exact-thread get-or-create, so a session whose provisioning was
   * interrupted (or whose backing DB was reset) recreates its thread instead
   * of binding to a fresh random-id thread the route can never find.
   */
  sessionThreadId?: string;
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
