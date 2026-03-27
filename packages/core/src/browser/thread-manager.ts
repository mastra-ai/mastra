/**
 * ThreadManager - Abstract base class for managing thread-scoped browser sessions.
 *
 * Similar to ProcessManager for workspaces, this centralizes thread lifecycle logic
 * and makes thread isolation reusable across browser providers.
 *
 * Thread isolation modes:
 * - 'none': All threads share a single browser session (no isolation)
 * - 'context': Each thread gets its own BrowserContext (isolated state, shared process)
 * - 'browser': Each thread gets its own browser process (full isolation)
 */

import type { IMastraLogger } from '../logger';

/** Thread isolation mode */
export type ThreadIsolationMode = 'none' | 'context' | 'browser';

/** Default thread ID used when no thread is specified */
export const DEFAULT_THREAD_ID = '__default__';

/**
 * Represents an active thread session.
 */
export interface ThreadSession {
  /** Unique thread identifier */
  threadId: string;
  /** Page/context index for 'context' mode */
  pageIndex?: number;
  /** Timestamp when session was created */
  createdAt: number;
  /** Last known URL for this thread (for restore on relaunch) */
  lastUrl?: string;
}

/**
 * Configuration for ThreadManager.
 */
export interface ThreadManagerConfig {
  /** Thread isolation mode */
  isolation: ThreadIsolationMode;
  /** Logger instance */
  logger?: IMastraLogger;
  /** Callback when a new session is created */
  onSessionCreated?: (session: ThreadSession) => void;
  /** Callback when a session is destroyed */
  onSessionDestroyed?: (threadId: string) => void;
}

/**
 * Abstract base class for managing thread-scoped browser sessions.
 *
 * @typeParam TManager - The browser manager type (e.g., BrowserManagerLike, Stagehand)
 */
export abstract class ThreadManager<TManager = unknown> {
  protected readonly isolation: ThreadIsolationMode;
  protected readonly logger?: IMastraLogger;
  protected readonly sessions = new Map<string, ThreadSession>();
  protected activeThreadId: string = DEFAULT_THREAD_ID;

  private readonly onSessionCreated?: (session: ThreadSession) => void;
  private readonly onSessionDestroyed?: (threadId: string) => void;

  constructor(config: ThreadManagerConfig) {
    this.isolation = config.isolation;
    this.logger = config.logger;
    this.onSessionCreated = config.onSessionCreated;
    this.onSessionDestroyed = config.onSessionDestroyed;
  }

  /**
   * Get the current isolation mode.
   */
  getIsolationMode(): ThreadIsolationMode {
    return this.isolation;
  }

  /**
   * Get the currently active thread ID.
   */
  getActiveThreadId(): string {
    return this.activeThreadId;
  }

  /**
   * Get a session by thread ID.
   */
  getSession(threadId: string): ThreadSession | undefined {
    return this.sessions.get(threadId);
  }

  /**
   * Check if a session exists for a thread.
   */
  hasSession(threadId: string): boolean {
    return this.sessions.has(threadId);
  }

  /**
   * List all active sessions.
   */
  listSessions(): ThreadSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get the number of active sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get or create a session for a thread, and return the browser manager for that thread.
   *
   * For 'none' mode, returns the shared manager.
   * For 'context' mode, creates/switches to the thread's context and returns the shared manager.
   * For 'browser' mode, creates/returns a dedicated manager for the thread.
   *
   * @param threadId - Thread identifier (uses DEFAULT_THREAD_ID if not provided)
   * @returns The browser manager for the thread
   */
  async getManagerForThread(threadId?: string): Promise<TManager> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;

    // No isolation - always use shared manager
    if (this.isolation === 'none' || effectiveThreadId === DEFAULT_THREAD_ID) {
      return this.getSharedManager();
    }

    // Check if session already exists
    let session = this.sessions.get(effectiveThreadId);

    if (!session) {
      // Create new session
      session = await this.createSession(effectiveThreadId);
      this.sessions.set(effectiveThreadId, session);
      this.logger?.debug?.(`Created thread session: ${effectiveThreadId}`);
      this.onSessionCreated?.(session);
    } else if (this.activeThreadId !== effectiveThreadId) {
      // Switch to existing session
      await this.switchToSession(session);
    }

    this.activeThreadId = effectiveThreadId;
    return this.getManagerForSession(session);
  }

  /**
   * Destroy a specific thread's session.
   *
   * @param threadId - Thread identifier
   */
  async destroySession(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) {
      return;
    }

    await this.doDestroySession(session);
    this.sessions.delete(threadId);
    this.logger?.debug?.(`Destroyed thread session: ${threadId}`);
    this.onSessionDestroyed?.(threadId);

    // Reset active thread if we destroyed it
    if (this.activeThreadId === threadId) {
      this.activeThreadId = DEFAULT_THREAD_ID;
    }
  }

  /**
   * Destroy all thread sessions.
   */
  async destroyAllSessions(): Promise<void> {
    const threadIds = Array.from(this.sessions.keys());
    for (const threadId of threadIds) {
      await this.destroySession(threadId);
    }
    this.activeThreadId = DEFAULT_THREAD_ID;
  }

  /**
   * Update the last URL for a thread session.
   */
  updateLastUrl(threadId: string, url: string): void {
    const session = this.sessions.get(threadId);
    if (session && url && url !== 'about:blank') {
      session.lastUrl = url;
    }
  }

  // ---------------------------------------------------------------------------
  // Abstract methods to be implemented by subclasses
  // ---------------------------------------------------------------------------

  /**
   * Get the shared browser manager (used for 'none' mode and default thread).
   */
  protected abstract getSharedManager(): TManager;

  /**
   * Create a new session for a thread.
   * Called when a thread is accessed for the first time.
   */
  protected abstract createSession(threadId: string): Promise<ThreadSession>;

  /**
   * Switch to an existing session.
   * Called when switching between threads in 'context' mode.
   */
  protected abstract switchToSession(session: ThreadSession): Promise<void>;

  /**
   * Get the browser manager for a specific session.
   */
  protected abstract getManagerForSession(session: ThreadSession): TManager;

  /**
   * Destroy a session and clean up resources.
   */
  protected abstract doDestroySession(session: ThreadSession): Promise<void>;
}
