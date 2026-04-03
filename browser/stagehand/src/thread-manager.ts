/**
 * StagehandThreadManager - Thread isolation for StagehandBrowser
 *
 * Supports two scope modes:
 * - 'none': All threads share the same Stagehand instance and page
 * - 'browser': Each thread gets its own Stagehand instance (separate browser)
 *
 * @see AgentBrowserThreadManager for the equivalent implementation.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import { ThreadManager } from '@mastra/core/browser';
import type { BrowserState, ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';

// Type aliases for Stagehand v3
// V3 is the Stagehand instance, V3Page is the page type from context.activePage()
type V3 = Stagehand;
type V3Page = NonNullable<ReturnType<NonNullable<Stagehand['context']>['activePage']>>;

/**
 * Extended session info for Stagehand threads.
 */
export interface StagehandThreadSession extends ThreadSession {
  /** For 'thread' mode: dedicated Stagehand instance */
  stagehand?: V3;
}

/**
 * Configuration for StagehandThreadManager.
 */
export interface StagehandThreadManagerConfig extends ThreadManagerConfig {
  /** Function to create a new Stagehand instance (for 'thread' mode) */
  createStagehand?: () => Promise<V3>;
  /** Callback when a new browser/Stagehand instance is created for a thread */
  onBrowserCreated?: (stagehand: V3, threadId: string) => void;
}

/**
 * Thread manager for StagehandBrowser.
 *
 * Supports two scope modes:
 * - 'none': All threads share the shared Stagehand instance
 * - 'browser': Each thread gets a dedicated Stagehand instance
 */
export class StagehandThreadManager extends ThreadManager<V3Page | V3> {
  private sharedStagehand: V3 | null = null;
  protected override sessions: Map<string, StagehandThreadSession> = new Map();
  private createStagehand?: () => Promise<V3>;
  private onBrowserCreated?: (stagehand: V3, threadId: string) => void;

  /** Map of thread ID to dedicated Stagehand instance (for 'thread' mode) */
  private readonly threadStagehands = new Map<string, V3>();

  constructor(config: StagehandThreadManagerConfig) {
    super(config);
    this.createStagehand = config.createStagehand;
    this.onBrowserCreated = config.onBrowserCreated;
  }

  /**
   * Set the shared Stagehand instance (called after browser launch).
   */
  setStagehand(instance: V3): void {
    this.sharedStagehand = instance;
  }

  /**
   * Clear the shared Stagehand instance (called when browser disconnects).
   */
  clearStagehand(): void {
    this.sharedStagehand = null;
  }

  /**
   * Set the factory function for creating new Stagehand instances.
   * Required for 'browser' scope mode.
   */
  setCreateStagehand(factory: () => Promise<V3>): void {
    this.createStagehand = factory;
  }

  /**
   * Get the shared Stagehand instance.
   */
  getSharedStagehand(): V3 {
    if (!this.sharedStagehand) {
      throw new Error('Stagehand not initialized');
    }
    return this.sharedStagehand;
  }

  /**
   * Get the Stagehand instance for a specific thread.
   * In 'shared' mode, returns the shared instance.
   * In 'thread' mode, returns the thread's dedicated instance.
   */
  getStagehandForThread(threadId: string): V3 | undefined {
    if (this.scope === 'thread') {
      const session = this.sessions.get(threadId);
      return session?.stagehand;
    }
    return this.sharedStagehand ?? undefined;
  }

  /**
   * Get the Stagehand page for a thread.
   * Returns the active page from the thread's Stagehand instance.
   */
  getPageForThread(threadId: string): V3Page | undefined {
    const stagehand = this.getStagehandForThread(threadId);
    return stagehand?.context?.activePage();
  }

  /**
   * Get the shared manager - returns the active page or the Stagehand instance.
   */
  protected getSharedManager(): V3Page | V3 {
    const stagehand = this.getSharedStagehand();
    return stagehand.context.activePage() ?? stagehand;
  }

  /**
   * Create a new session for a thread.
   */
  protected override async createSession(threadId: string): Promise<StagehandThreadSession> {
    // Check for saved browser state before creating new session (for browser restore)
    const savedState = this.getSavedBrowserState(threadId);

    const session: StagehandThreadSession = {
      threadId,
      createdAt: Date.now(),
      browserState: savedState,
    };

    if (this.scope === 'thread') {
      // Full thread scope - create a new Stagehand instance
      if (!this.createStagehand) {
        throw new Error('createStagehand factory not set - required for thread scope');
      }

      this.logger?.debug?.(`Creating dedicated Stagehand instance for thread ${threadId}`);
      const stagehand = await this.createStagehand();
      session.stagehand = stagehand;
      this.threadStagehands.set(threadId, stagehand);

      // Restore browser state if available (before notifying parent to avoid screencast race)
      if (savedState && savedState.tabs.length > 0) {
        this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
        await this.restoreBrowserState(stagehand, savedState);
      }

      // Notify parent browser so it can set up close listeners
      // This is done after restoration so the screencast starts on the correct active page
      this.onBrowserCreated?.(stagehand, threadId);
    }
    // For 'shared' scope, no session setup needed - all threads share the instance

    return session;
  }

  /**
   * Restore browser state (multiple tabs) to a Stagehand instance.
   */
  private async restoreBrowserState(stagehand: V3, state: BrowserState): Promise<void> {
    try {
      const context = stagehand.context;
      if (!context) return;

      // Navigate first tab to first URL
      const firstTab = state.tabs[0];
      if (firstTab?.url) {
        const page = context.activePage();
        if (page) {
          await page.goto(firstTab.url, { waitUntil: 'domcontentloaded' });
        }
      }

      // Open additional tabs using context.newPage()
      for (let i = 1; i < state.tabs.length; i++) {
        const tab = state.tabs[i];
        if (tab?.url) {
          await context.newPage(tab.url);
        }
      }

      // Always switch to the correct active tab
      // (newPage() makes the new page active, so we need to switch back if needed)
      const pages = context.pages();
      const targetPage = pages[state.activeTabIndex];
      if (targetPage && targetPage !== context.activePage()) {
        context.setActivePage(targetPage);
      }
    } catch (error) {
      this.logger?.warn?.(`Failed to restore browser state: ${error}`);
    }
  }

  /**
   * Switch to an existing session.
   * For 'thread' mode, no switching needed - each thread has its own instance.
   * For 'shared' mode, nothing to switch.
   */
  protected override async switchToSession(_session: StagehandThreadSession): Promise<void> {
    // No-op for both modes - 'browser' has separate instances, 'none' shares everything
  }

  /**
   * Get the manager for a specific session.
   */
  protected override getManagerForSession(session: StagehandThreadSession): V3Page | V3 {
    if (this.scope === 'thread' && session.stagehand) {
      return session.stagehand.context.activePage() ?? session.stagehand;
    }
    return this.getSharedManager();
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected override async doDestroySession(session: StagehandThreadSession): Promise<void> {
    if (this.scope === 'thread' && session.stagehand) {
      // Close the dedicated Stagehand instance
      try {
        await session.stagehand.close();
        this.logger?.debug?.(`Closed Stagehand instance for thread ${session.threadId}`);
      } catch (error) {
        this.logger?.warn?.(`Failed to close Stagehand for thread ${session.threadId}: ${error}`);
      }
      this.threadStagehands.delete(session.threadId);
    }
    // For 'shared' mode, nothing to clean up - all threads share the instance
  }

  /**
   * Clean up all thread sessions.
   */
  async destroyAll(): Promise<void> {
    // Close all dedicated Stagehand instances
    for (const [threadId, stagehand] of this.threadStagehands) {
      try {
        await stagehand.close();
      } catch {
        this.logger?.debug?.(`Failed to close Stagehand for thread: ${threadId}`);
      }
    }
    this.threadStagehands.clear();

    // Clear sessions
    this.sessions.clear();
  }

  /**
   * Check if any thread Stagehands are still running.
   */
  hasActiveThreadStagehands(): boolean {
    return this.threadStagehands.size > 0;
  }

  /**
   * Clear all session tracking without closing browsers.
   * Used when browsers have been externally closed and we just need to reset state.
   */
  clearAllSessions(): void {
    this.threadStagehands.clear();
    this.sessions.clear();
  }

  /**
   * Clear a specific thread's session without closing the browser.
   * Used when a thread's browser has been externally closed.
   * Preserves the browser state for potential restoration.
   * @param threadId - The thread ID to clear
   */
  override clearSession(threadId: string): void {
    this.threadStagehands.delete(threadId);
    super.clearSession(threadId);
  }
}
