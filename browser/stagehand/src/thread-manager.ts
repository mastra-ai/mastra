/**
 * StagehandThreadManager - Thread isolation for StagehandBrowser
 *
 * Supports two isolation modes:
 * - 'none': All threads share the same Stagehand instance and page
 * - 'browser': Each thread gets its own Stagehand instance (separate browser)
 *
 * @see AgentBrowserThreadManager for the equivalent implementation.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import { ThreadManager } from '@mastra/core/browser';
import type { ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';

// Type aliases for Stagehand v3
// V3 is the Stagehand instance, V3Page is the page type from context.activePage()
type V3 = Stagehand;
type V3Page = NonNullable<ReturnType<NonNullable<Stagehand['context']>['activePage']>>;

/**
 * Extended session info for Stagehand threads.
 */
export interface StagehandThreadSession extends ThreadSession {
  /** For 'browser' mode: dedicated Stagehand instance */
  stagehand?: V3;
}

/**
 * Configuration for StagehandThreadManager.
 */
export interface StagehandThreadManagerConfig extends ThreadManagerConfig {
  /** Function to create a new Stagehand instance (for 'browser' mode) */
  createStagehand?: () => Promise<V3>;
  /** Callback when a new browser/Stagehand instance is created for a thread */
  onBrowserCreated?: (stagehand: V3, threadId: string) => void;
}

/**
 * Thread manager for StagehandBrowser.
 *
 * Supports two isolation modes:
 * - 'none': All threads share the shared Stagehand instance
 * - 'browser': Each thread gets a dedicated Stagehand instance
 */
export class StagehandThreadManager extends ThreadManager<V3Page | V3> {
  private sharedStagehand: V3 | null = null;
  protected override sessions: Map<string, StagehandThreadSession> = new Map();
  private createStagehand?: () => Promise<V3>;
  private onBrowserCreated?: (stagehand: V3, threadId: string) => void;

  /** Map of thread ID to dedicated Stagehand instance (for 'browser' mode) */
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
   * Required for 'browser' isolation mode.
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
   * In 'none' mode, returns the shared instance.
   * In 'browser' mode, returns the thread's dedicated instance.
   */
  getStagehandForThread(threadId: string): V3 | undefined {
    if (this.isolation === 'browser') {
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
    // Check for saved lastUrl before creating new session (for browser restore)
    const savedUrl = this.getSavedLastUrl(threadId);

    const session: StagehandThreadSession = {
      threadId,
      createdAt: Date.now(),
      lastUrl: savedUrl, // Restore saved URL
    };

    if (this.isolation === 'browser') {
      // Full browser isolation - create a new Stagehand instance
      if (!this.createStagehand) {
        throw new Error('createStagehand factory not set - required for browser isolation');
      }

      this.logger?.debug?.(`Creating dedicated Stagehand instance for thread ${threadId}`);
      const stagehand = await this.createStagehand();
      session.stagehand = stagehand;
      this.threadStagehands.set(threadId, stagehand);

      // Notify parent browser so it can set up close listeners
      this.onBrowserCreated?.(stagehand, threadId);

      // Restore last URL if available
      if (savedUrl) {
        this.logger?.debug?.(`Restoring URL for thread ${threadId}: ${savedUrl}`);
        try {
          const page = stagehand.context.activePage();
          if (page) {
            await page.goto(savedUrl, { waitUntil: 'domcontentloaded' });
          }
        } catch (error) {
          this.logger?.warn?.(`Failed to restore URL for thread ${threadId}: ${error}`);
        }
      }
    }
    // For 'none' isolation, no session setup needed - all threads share the instance

    return session;
  }

  /**
   * Switch to an existing session.
   * For 'browser' mode, no switching needed - each thread has its own instance.
   * For 'none' mode, nothing to switch.
   */
  protected override async switchToSession(_session: StagehandThreadSession): Promise<void> {
    // No-op for both modes - 'browser' has separate instances, 'none' shares everything
  }

  /**
   * Get the manager for a specific session.
   */
  protected override getManagerForSession(session: StagehandThreadSession): V3Page | V3 {
    if (this.isolation === 'browser' && session.stagehand) {
      return session.stagehand.context.activePage() ?? session.stagehand;
    }
    return this.getSharedManager();
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected override async doDestroySession(session: StagehandThreadSession): Promise<void> {
    if (this.isolation === 'browser' && session.stagehand) {
      // Close the dedicated Stagehand instance
      try {
        await session.stagehand.close();
        this.logger?.debug?.(`Closed Stagehand instance for thread ${session.threadId}`);
      } catch (error) {
        this.logger?.warn?.(`Failed to close Stagehand for thread ${session.threadId}: ${error}`);
      }
      this.threadStagehands.delete(session.threadId);
    }
    // For 'none' mode, nothing to clean up - all threads share the instance
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
   * Preserves the lastUrl for potential restoration.
   * @param threadId - The thread ID to clear
   */
  clearSession(threadId: string): void {
    // Save the lastUrl before clearing so it can be restored on relaunch
    const session = this.sessions.get(threadId);
    if (session?.lastUrl) {
      this.savedLastUrls.set(threadId, session.lastUrl);
    }
    this.threadStagehands.delete(threadId);
    this.sessions.delete(threadId);
  }
}
