import { createContext } from 'react';

import type { ThreadOwner } from '../services/reply-credential';

export interface FactorySessionState {
  factoryProjectId: string;
  projectRepositoryId?: string;
}

export interface ChatSessionContextApi {
  /** Agent-controller session address (=== the session's thread id for Factory sessions). */
  sessionId: string;
  /**
   * Memory resource the session runs under: the Factory for runs and Slack
   * sessions, the owner for user sessions. Shared with the resource's other
   * sessions; used only to create the session.
   */
  resourceId: string;
  /** Tags that pick this session's threads out of its shared resource. */
  threadTags?: Record<string, string>;
  /**
   * Alias for `sandboxReady` retained for existing consumers. New code should
   * use `sandboxReady` (mutations, runs) or `resourceReady` (reads/streaming)
   * to make the gating intent explicit.
   */
  sessionEnabled: boolean;
  /**
   * Server-side session metadata is resolved and the agent-controller
   * session is safe to address for reads/streaming. Never waits on a
   * sandbox existing.
   */
  resourceReady: boolean;
  /**
   * Session metadata resolved and runs can be sent. The server materializes
   * sandboxes lazily on first use, so this never waits on one.
   * Gate any write/run consumer on this flag.
   */
  sandboxReady: boolean;
  /**
   * Session metadata is still resolving for an in-session mount. UI should
   * show a preparing affordance while true.
   */
  sandboxPreparing: boolean;
  resourceEnabled: boolean;
  /**
   * Failure resolving the session itself (denied/missing/errored session
   * query). Fatal — the chat surface replaces its content with an error state.
   */
  sessionError?: Error;
  /** Re-runs the failed session query. */
  retrySession?: () => void;
  /**
   * The session's conventional thread id (=== its sessionId, seeded by
   * FactoryStartCoordinator). Passing it through session creation makes init
   * an exact-thread get-or-create, so a session whose provisioning was
   * interrupted (or whose backing DB was reset) recreates its thread instead
   * of binding to a fresh random-id thread the route can never find.
   */
  sessionThreadId?: string;
  /** The session's workspace has never been materialized, so status reads as still setting up. */
  workspacePending?: boolean;
  draftSessionId?: string;
  factorySessionState?: FactorySessionState;
  baseUrl: string;
  /**
   * 'factory' — org-scoped session bound to a factory worktree of a GitHub
   * project (runs are driven by the factory).
   * 'user' — personal session (a `user/` worktree opened via
   * /user/threads/*); its draft can pick a model before the session exists.
   */
  kind: 'factory' | 'user';
  /** Who the stored session belongs to; absent where no session row backs the chat (supervisor, `?resourceId=` override). */
  owner?: ThreadOwner;
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
