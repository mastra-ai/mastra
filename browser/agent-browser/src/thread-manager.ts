/**
 * AgentBrowserThreadManager - Thread isolation for AgentBrowser
 *
 * Manages thread-scoped browser sessions using agent-browser's
 * BrowserManager capabilities (newWindow, switchTo, closeTab).
 */

import { ThreadManager } from '@mastra/core/browser';
import type { BrowserState, ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';
import { BrowserManager } from 'agent-browser';
import type { BrowserLaunchOptions } from 'agent-browser';
import type { BrowserConfig } from './types';

/**
 * Extended session info for AgentBrowser.
 */
interface AgentBrowserSession extends ThreadSession {
  /** For 'browser' mode: dedicated browser manager instance */
  manager?: BrowserManager;
}

/**
 * Configuration for AgentBrowserThreadManager.
 */
export interface AgentBrowserThreadManagerConfig extends ThreadManagerConfig {
  /** Browser configuration for launching new instances */
  browserConfig: BrowserConfig;
  /** Function to resolve CDP URL (may be async) */
  resolveCdpUrl?: (cdpUrl: string | (() => string | Promise<string>)) => Promise<string>;
  /** Callback when a new browser manager is created for a thread */
  onBrowserCreated?: (manager: BrowserManager, threadId: string) => void;
}

/**
 * Thread manager implementation for AgentBrowser.
 *
 * Supports two isolation modes:
 * - 'none': All threads share the shared browser manager
 * - 'browser': Each thread gets a dedicated browser manager instance
 */
export class AgentBrowserThreadManager extends ThreadManager<BrowserManager> {
  private sharedManager: BrowserManager | null = null;
  private readonly browserConfig: BrowserConfig;
  private readonly resolveCdpUrl?: (cdpUrl: string | (() => string | Promise<string>)) => Promise<string>;
  private readonly onBrowserCreated?: (manager: BrowserManager, threadId: string) => void;

  /** Map of thread ID to dedicated browser manager (for 'browser' mode) */
  private readonly threadBrowsers = new Map<string, BrowserManager>();

  constructor(config: AgentBrowserThreadManagerConfig) {
    super(config);
    this.browserConfig = config.browserConfig;
    this.resolveCdpUrl = config.resolveCdpUrl;
    this.onBrowserCreated = config.onBrowserCreated;
  }

  /**
   * Set the shared browser manager (called after browser launch).
   */
  setSharedManager(manager: BrowserManager): void {
    this.sharedManager = manager;
  }

  /**
   * Clear the shared browser manager (called when browser disconnects).
   */
  clearSharedManager(): void {
    this.sharedManager = null;
  }

  /**
   * Get the shared browser manager.
   */
  protected getSharedManager(): BrowserManager {
    if (!this.sharedManager) {
      throw new Error('Browser not launched');
    }
    return this.sharedManager;
  }

  /**
   * Create a new session for a thread.
   */
  protected async createSession(threadId: string): Promise<AgentBrowserSession> {
    // Check for saved browser state before creating new session (for browser restore)
    const savedState = this.getSavedBrowserState(threadId);

    const session: AgentBrowserSession = {
      threadId,
      createdAt: Date.now(),
      browserState: savedState,
    };

    if (this.isolation === 'browser') {
      // Full browser isolation - create a new browser manager
      const manager = new BrowserManager();

      const launchOptions: BrowserLaunchOptions = {
        headless: this.browserConfig.headless ?? true,
      };

      if (this.browserConfig.cdpUrl && this.resolveCdpUrl) {
        launchOptions.cdpUrl = await this.resolveCdpUrl(this.browserConfig.cdpUrl);
      }

      await manager.launch(launchOptions);
      session.manager = manager;
      this.threadBrowsers.set(threadId, manager);

      // Notify parent browser so it can set up close listeners
      this.onBrowserCreated?.(manager, threadId);

      // Restore browser state if available
      if (savedState && savedState.tabs.length > 0) {
        this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
        await this.restoreBrowserState(manager, savedState);
      }
    }
    // For 'none' isolation, no session setup needed - all threads share the manager

    return session;
  }

  /**
   * Restore browser state (multiple tabs) to a browser manager.
   */
  private async restoreBrowserState(manager: BrowserManager, state: BrowserState): Promise<void> {
    try {
      // Navigate first tab to first URL
      const firstTab = state.tabs[0];
      if (firstTab?.url) {
        const page = manager.getPage();
        if (page) {
          await page.goto(firstTab.url, { waitUntil: 'domcontentloaded' });
        }
      }

      // Open additional tabs
      for (let i = 1; i < state.tabs.length; i++) {
        const tab = state.tabs[i];
        if (tab?.url) {
          // newTab() creates a blank tab, then we navigate to the URL
          await manager.newTab();
          const page = manager.getPage();
          if (page) {
            await page.goto(tab.url, { waitUntil: 'domcontentloaded' });
          }
        }
      }

      // Switch to the active tab
      if (state.activeTabIndex > 0 && state.activeTabIndex < state.tabs.length) {
        await manager.switchTo(state.activeTabIndex);
      }
    } catch (error) {
      this.logger?.warn?.(`Failed to restore browser state: ${error}`);
    }
  }

  /**
   * Switch to an existing session.
   * For 'browser' mode, no switching needed - each thread has its own manager.
   * For 'none' mode, nothing to switch.
   */
  protected async switchToSession(_session: AgentBrowserSession): Promise<void> {
    // No-op for both modes - 'browser' has separate managers, 'none' shares everything
  }

  /**
   * Get the browser manager for a specific session.
   */
  protected getManagerForSession(session: AgentBrowserSession): BrowserManager {
    if (this.isolation === 'browser' && session.manager) {
      return session.manager;
    }
    return this.getSharedManager();
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected async doDestroySession(session: AgentBrowserSession): Promise<void> {
    if (this.isolation === 'browser' && session.manager) {
      // Close the dedicated browser manager
      await session.manager.close();
      this.threadBrowsers.delete(session.threadId);
    }
    // For 'none' mode, nothing to clean up - all threads share the manager
  }

  /**
   * Destroy all sessions (called during browser close).
   */
  override async destroyAllSessions(): Promise<void> {
    // Close all dedicated browser managers
    for (const [threadId, manager] of this.threadBrowsers) {
      try {
        await manager.close();
      } catch {
        this.logger?.debug?.(`Failed to close browser for thread: ${threadId}`);
      }
    }
    this.threadBrowsers.clear();

    // Clear context sessions (contexts are closed when shared browser closes)
    await super.destroyAllSessions();
  }

  /**
   * Check if any thread browsers are still running.
   */
  hasActiveThreadBrowsers(): boolean {
    return this.threadBrowsers.size > 0;
  }

  /**
   * Get the browser manager for an existing thread session without creating a new one.
   * Returns null if no session exists for the thread.
   */
  getExistingManagerForThread(threadId: string): BrowserManager | null {
    if (this.isolation === 'browser') {
      return this.threadBrowsers.get(threadId) ?? null;
    }
    return this.sharedManager;
  }

  /**
   * Clear all session tracking without closing browsers.
   * Used when browsers have been externally closed and we just need to reset state.
   */
  clearAllSessions(): void {
    this.threadBrowsers.clear();
    this.sessions.clear();
  }

  /**
   * Clear a specific thread's session without closing the browser.
   * Used when a thread's browser has been externally closed.
   * Preserves the browser state for potential restoration.
   * @param threadId - The thread ID to clear
   */
  clearSession(threadId: string): void {
    // Save the browser state before clearing so it can be restored on relaunch
    const session = this.sessions.get(threadId);
    if (session?.browserState) {
      this.savedBrowserStates.set(threadId, session.browserState);
    }
    this.threadBrowsers.delete(threadId);
    this.sessions.delete(threadId);
  }
}
