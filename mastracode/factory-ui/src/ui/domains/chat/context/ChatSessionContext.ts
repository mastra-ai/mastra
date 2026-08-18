import { createContext } from 'react';

import type { PrepareProgress } from '../../workspaces/services/github';

export interface FactorySessionState {
  factoryProjectId: string;
  projectRepositoryId?: string;
  sandboxId?: string;
  sandboxWorkdir?: string;
}

export interface ChatSessionContextApi {
  resourceId: string;
  /**
   * Alias for `sandboxReady` retained for existing consumers. New code should
   * use `sandboxReady` (mutations, runs) or `resourceReady` (reads/streaming)
   * to make the gating intent explicit.
   */
  sessionEnabled: boolean;
  /**
   * Server-side session metadata is resolved and the agent-controller
   * resourceId is safe to address for reads/streaming. Does NOT wait on
   * sandbox provisioning (`/ensure`).
   */
  resourceReady: boolean;
  /**
   * `/ensure` has succeeded and runs can execute in the sandbox. Gate any
   * write/run consumer on this flag.
   */
  sandboxReady: boolean;
  /**
   * `/ensure` is in flight (or not yet started because deps aren't ready) for
   * an in-session mount. UI should show a preparing affordance while true.
   */
  sandboxPreparing: boolean;
  /**
   * Latest SSE progress event from `/ensure`, or `undefined` before the first
   * event arrives or when no preparation is in progress.
   */
  sandboxProgress: PrepareProgress | undefined;
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
  /** Workspace needs sandbox provision + clone before the controller can connect. */
  workspacePending?: boolean;
  draftSessionId?: string;
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
