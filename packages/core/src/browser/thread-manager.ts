/**
 * ThreadManager - Abstract base class for managing thread-scoped browser sessions.
 *
 * Similar to ProcessManager for workspaces, this centralizes thread lifecycle logic
 * and makes thread isolation reusable across browser providers.
 *
 * Browser scope modes:
 * - 'shared': All threads share a single browser instance
 * - 'thread': Each thread gets its own browser instance (full isolation)
 */

import type { IMastraLogger } from '../logger';

/** Browser scope mode - determines how browser instances are shared across threads */
export type BrowserScope = 'shared' | 'thread';

/** Default thread ID used when no thread is specified */
export const DEFAULT_THREAD_ID = '__default__';

/**
 * Represents a single tab's state for persistence.
 */
export interface BrowserTabState {
  url: string;
  title?: string;
}

/**
 * Full browser state for persistence and restoration.
 */
export interface BrowserState {
  tabs: BrowserTabState[];
  activeTabIndex: number;
}

/**
 * Represents an active thread session.
 */
export interface ThreadSession {
  /** Unique thread identifier */
  threadId: string;
  /** Timestamp when session was created */
  createdAt: number;
  /** Full browser state for this thread (for restore on relaunch) */
  browserState?: BrowserState;
}

/**
 * Configuration for ThreadManager.
 */
export interface ThreadManagerConfig {
  /** Browser scope mode */
  scope: BrowserScope;
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
  protected readonly scope: BrowserScope;
  protected readonly logger?: IMastraLogger;
  protected readonly sessions = new Map<string, ThreadSession>();
  protected activeThreadId: string = DEFAULT_THREAD_ID;

  /** Preserved browser state that survives session clears (for browser restore) */
  protected readonly savedBrowserStates = new Map<string, BrowserState>();

  /** Shared manager instance (used for 'shared' scope) */
  protected sharedManager: TManager | null = null;

  /** Map of thread ID to dedicated manager instance (for 'thread' scope) */
  protected readonly threadManagers = new Map<string, TManager>();

  private readonly onSessionCreated?: (session: ThreadSession) => void;
  private readonly onSessionDestroyed?: (threadId: string) => void;

  constructor(config: ThreadManagerConfig) {
    this.scope = config.scope;
    this.logger = config.logger;
    this.onSessionCreated = config.onSessionCreated;
    this.onSessionDestroyed = config.onSessionDestroyed;
  }

  /**
   * Get the current browser scope mode.
   */
  getScope(): BrowserScope {
    return this.scope;
  }

  /**
   * Get the currently active thread ID.
   */
  getActiveThreadId(): string {
    return this.activeThreadId;
  }

  /**
   * Set the shared manager instance (called after browser launch).
   */
  setSharedManager(manager: TManager): void {
    this.sharedManager = manager;
  }

  /**
   * Clear the shared manager instance (called when browser disconnects).
   */
  clearSharedManager(): void {
    this.sharedManager = null;
  }

  /**
   * Get the manager for an existing thread session without creating a new one.
   *
   * For 'thread' scope: Returns the thread-specific manager, or null if no session exists.
   * For 'shared' scope: Returns the shared manager (all threads use the same instance).
   *
   * @param threadId - Thread identifier (defaults to DEFAULT_THREAD_ID)
   * @returns The manager for the thread, or null if not found (thread scope only)
   */
  getExistingManagerForThread(threadId?: string): TManager | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    if (this.scope === 'thread') {
      return this.threadManagers.get(effectiveThreadId) ?? null;
    }
    return this.sharedManager;
  }

  /**
   * Check if any thread managers are still running (for 'thread' scope).
   */
  hasActiveThreadManagers(): boolean {
    return this.threadManagers.size > 0;
  }

  /**
   * Clear all session tracking without closing managers.
   * Used when browsers have been externally closed and we just need to reset state.
   */
  clearAllSessions(): void {
    this.threadManagers.clear();
    this.sessions.clear();
    this.activeThreadId = DEFAULT_THREAD_ID;
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
   * For 'shared' scope, returns the shared manager.
   * For 'thread' scope, creates/returns a dedicated manager for the thread.
   *
   * @param threadId - Thread identifier (uses DEFAULT_THREAD_ID if not provided)
   * @returns The browser manager for the thread
   */
  async getManagerForThread(threadId?: string): Promise<TManager> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;

    // Shared scope - always use shared manager
    if (this.scope === 'shared' || effectiveThreadId === DEFAULT_THREAD_ID) {
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
    this.threadManagers.delete(threadId);
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
   * Update the browser state for a thread session.
   * Also saves to persistent storage so state survives session clears.
   */
  updateBrowserState(threadId: string, state: BrowserState): void {
    // Filter out empty/blank tabs
    const filteredTabs = state.tabs.filter(tab => tab.url && tab.url !== 'about:blank');
    if (filteredTabs.length === 0) {
      return;
    }

    const filteredState: BrowserState = {
      tabs: filteredTabs,
      activeTabIndex: Math.max(0, Math.min(state.activeTabIndex, filteredTabs.length - 1)),
    };

    const session = this.sessions.get(threadId);
    if (session) {
      session.browserState = filteredState;
    }
    // Also save to persistent map so it survives session clears
    this.savedBrowserStates.set(threadId, filteredState);
  }

  /**
   * Get the saved browser state for a thread (survives session clears).
   */
  getSavedBrowserState(threadId: string): BrowserState | undefined {
    // First check current session
    const session = this.sessions.get(threadId);
    if (session?.browserState) {
      return session.browserState;
    }
    // Fall back to saved state
    return this.savedBrowserStates.get(threadId);
  }

  /**
   * Clear a specific thread's session without closing the browser.
   * Used when a thread's browser has been externally closed.
   * Preserves the browser state for potential restoration.
   *
   * @param threadId - The thread ID to clear
   */
  clearSession(threadId: string): void {
    // Save the browser state before clearing so it can be restored on relaunch
    const session = this.sessions.get(threadId);
    if (session?.browserState) {
      this.savedBrowserStates.set(threadId, session.browserState);
    }
    this.threadManagers.delete(threadId);
    this.sessions.delete(threadId);
    // Reset activeThreadId if we just cleared it
    if (this.activeThreadId === threadId) {
      this.activeThreadId = DEFAULT_THREAD_ID;
    }
  }

  // ---------------------------------------------------------------------------
  // Abstract methods to be implemented by subclasses
  // ---------------------------------------------------------------------------

  /**
   * Get the shared browser manager (used for 'shared' scope and default thread).
   * @throws Error if shared manager is not initialized
   */
  protected getSharedManager(): TManager {
    if (!this.sharedManager) {
      throw new Error('Browser not launched');
    }
    return this.sharedManager;
  }

  /**
   * Create a new session for a thread.
   * Called when a thread is accessed for the first time.
   */
  protected abstract createSession(threadId: string): Promise<ThreadSession>;

  /**
   * Get the browser manager for a specific session.
   */
  protected abstract getManagerForSession(session: ThreadSession): TManager;

  /**
   * Destroy a session and clean up resources.
   */
  protected abstract doDestroySession(session: ThreadSession): Promise<void>;
}
