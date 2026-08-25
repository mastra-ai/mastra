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
   * Session metadata resolved and runs can be sent. Does NOT wait on the
   * `/ensure` warm-up — the server materializes sandboxes lazily on first use.
   * Gate any write/run consumer on this flag.
   */
  sandboxReady: boolean;
  /**
   * Session metadata is still resolving for an in-session mount. UI should
   * show a preparing affordance while true.
   */
  sandboxPreparing: boolean;
  /**
   * Latest SSE progress event from the background `/ensure` warm-up, or
   * `undefined` before the first event arrives or when no warm-up is in
   * progress. Informational only — never blocks the chat UI.
   */
  sandboxProgress: PrepareProgress | undefined;
  /**
   * The background `/ensure` warm-up is still in flight. Lets the prepare
   * stepper keep "Preparing sandbox" active before the first progress event
   * arrives instead of skipping ahead to message loading.
   */
  sandboxWarming?: boolean;
  resourceEnabled: boolean;
  /**
   * Failure resolving the session itself (denied/missing/errored session
   * query). Fatal — the chat surface replaces its content with an error state.
   */
  sessionError?: Error;
  /**
   * Failure from the background workspace warm-up (`/ensure`). Non-fatal —
   * the run path materializes lazily — so surfaces show it as a banner with a
   * retry affordance rather than disabling the session.
   */
  warmupError?: Error;
  /** Re-runs the failed session query and/or workspace warm-up. */
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
