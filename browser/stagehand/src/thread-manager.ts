/**
 * StagehandThreadManager - Thread scope management for StagehandBrowser
 *
 * Supports two scope modes:
 * - 'shared': All threads share the same Stagehand instance and page
 * - 'thread': Each thread gets its own Stagehand instance (separate browser)
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
 * - 'shared': All threads share the shared Stagehand instance
 * - 'thread': Each thread gets a dedicated Stagehand instance
 */
export class StagehandThreadManager extends ThreadManager<V3> {
  protected override sessions: Map<string, StagehandThreadSession> = new Map();
  private createStagehand?: () => Promise<V3>;
  private onBrowserCreated?: (stagehand: V3, threadId: string) => void;

  constructor(config: StagehandThreadManagerConfig) {
    super(config);
    this.createStagehand = config.createStagehand;
    this.onBrowserCreated = config.onBrowserCreated;
  }

  /**
   * Set the factory function for creating new Stagehand instances.
   * Required for 'thread' scope mode.
   */
  setCreateStagehand(factory: () => Promise<V3>): void {
    this.createStagehand = factory;
  }

  /**
   * Get the page for a specific thread, creating session if needed.
   */
  async getPageForThread(threadId?: string): Promise<V3Page | null> {
    const stagehand = await this.getManagerForThread(threadId);
    return stagehand?.context?.activePage() ?? null;
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
      this.threadManagers.set(threadId, stagehand);

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
   * Get the manager (Stagehand instance) for a specific session.
   */
  protected override getManagerForSession(session: StagehandThreadSession): V3 {
    if (this.scope === 'thread' && session.stagehand) {
      return session.stagehand;
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
    }
    // For 'shared' mode, nothing to clean up - all threads share the instance
  }

  /**
   * Destroy all sessions (called during browser close).
   * doDestroySession handles closing individual Stagehand instances.
   */
  override async destroyAllSessions(): Promise<void> {
    await super.destroyAllSessions();
  }
}
