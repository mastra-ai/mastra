/**
 * StagehandThreadManager - Thread isolation for StagehandBrowser
 *
 * Supports two isolation modes:
 * - 'none': All threads share the same page (default)
 * - 'context': Each thread gets its own page/tab within the browser
 *
 * Note: 'browser' mode (separate browser instances) is not supported for Stagehand
 * as each Stagehand instance manages its own browser lifecycle.
 *
 * @see AgentBrowserThreadManager for a full implementation with 'browser' mode.
 */

import { ThreadManager, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type { ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';

// Import V3 (Stagehand) types
type V3 = import('@browserbasehq/stagehand').V3;
type V3Page = Awaited<ReturnType<V3['context']['newPage']>>;

/**
 * Extended session info for Stagehand threads.
 */
export interface StagehandThreadSession extends ThreadSession {
  /** The page associated with this thread (for 'context' mode) */
  page?: V3Page;
  /** Index in the pages array (for switching) */
  pageIndex?: number;
}

/**
 * Configuration for StagehandThreadManager.
 */
export interface StagehandThreadManagerConfig extends ThreadManagerConfig {
  // Future: Add Stagehand-specific config here
}

/**
 * Thread manager for StagehandBrowser.
 *
 * Implements thread isolation using Stagehand's multi-page support.
 * Each thread can get its own page/tab within the shared browser context.
 */
export class StagehandThreadManager extends ThreadManager<V3Page | V3> {
  private stagehand: V3 | null = null;
  protected override sessions: Map<string, StagehandThreadSession> = new Map();

  constructor(config: StagehandThreadManagerConfig) {
    // Default to 'none' if not specified
    const isolation = config.isolation ?? 'none';

    // 'browser' mode is not supported for Stagehand
    if (isolation === 'browser') {
      config.logger?.warn?.(
        `StagehandBrowser: Thread isolation mode 'browser' is not supported. Using 'context' instead.`,
      );
      super({ ...config, isolation: 'context' });
    } else {
      super({ ...config, isolation });
    }
  }

  /**
   * Set the shared Stagehand instance (called after browser launch).
   */
  setStagehand(instance: V3): void {
    this.stagehand = instance;
  }

  /**
   * Get the shared Stagehand instance.
   */
  getStagehand(): V3 {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }
    return this.stagehand;
  }

  /**
   * Get the Stagehand page for a thread.
   * In 'none' mode, returns the active page.
   * In 'context' mode, returns the thread's dedicated page.
   */
  getPageForThread(threadId: string): V3Page | undefined {
    const stagehand = this.getStagehand();

    if (this.isolation === 'none') {
      return stagehand.context.activePage();
    }

    const session = this.sessions.get(threadId);
    return session?.page;
  }

  /**
   * Get the shared manager - returns the active page or the Stagehand instance.
   */
  protected getSharedManager(): V3Page | V3 {
    const stagehand = this.getStagehand();
    return stagehand.context.activePage() ?? stagehand;
  }

  /**
   * Create a new session with its own page (for 'context' mode).
   */
  protected override async createSession(threadId: string): Promise<StagehandThreadSession> {
    const stagehand = this.getStagehand();

    if (this.isolation === 'none') {
      // No isolation - just track the session
      return {
        threadId,
        createdAt: Date.now(),
      };
    }

    // 'context' mode - create a new page for this thread
    const page = await stagehand.context.newPage();
    const pages = stagehand.context.pages();
    const pageIndex = pages.indexOf(page);

    this.logger?.debug?.(`Created new page for thread ${threadId} (index: ${pageIndex})`);

    return {
      threadId,
      createdAt: Date.now(),
      page,
      pageIndex,
    };
  }

  /**
   * Switch to an existing session's page.
   */
  protected override async switchToSession(session: StagehandThreadSession): Promise<void> {
    if (this.isolation === 'none') {
      return; // No-op in 'none' mode
    }

    const stagehand = this.getStagehand();

    if (session.page) {
      stagehand.context.setActivePage(session.page);
      this.logger?.debug?.(`Switched to page for thread ${session.threadId}`);
    }
  }

  /**
   * Get the page for a session.
   */
  protected override getManagerForSession(session: StagehandThreadSession): V3Page | V3 {
    if (this.isolation === 'none' || !session.page) {
      return this.getSharedManager();
    }
    return session.page;
  }

  /**
   * Destroy a session and close its page (for 'context' mode).
   */
  protected override async doDestroySession(session: StagehandThreadSession): Promise<void> {
    if (this.isolation === 'none') {
      return; // No-op in 'none' mode
    }

    // Close the thread's page if it exists
    if (session.page) {
      try {
        await session.page.close();
        this.logger?.debug?.(`Closed page for thread ${session.threadId}`);
      } catch (error) {
        this.logger?.warn?.(`Failed to close page for thread ${session.threadId}: ${error}`);
      }
    }
  }

  /**
   * Clean up all thread pages.
   */
  async destroyAll(): Promise<void> {
    const sessions = Array.from(this.sessions.values());

    for (const session of sessions) {
      // Don't close the default thread's page - let Stagehand handle that
      if (session.threadId !== DEFAULT_THREAD_ID) {
        await this.destroySession(session.threadId);
      }
    }

    this.sessions.clear();
  }
}
