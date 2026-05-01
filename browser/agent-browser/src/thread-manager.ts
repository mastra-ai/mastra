/**
 * AgentBrowserThreadManager - Thread scope management for AgentBrowser
 *
 * Manages thread-scoped browser sessions using agent-browser's
 * BrowserManager capabilities (newWindow, switchTo, closeTab).
 */

import { ThreadManager } from '@mastra/core/browser';
import type { BrowserState, ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';
import { BrowserManager } from 'agent-browser';
import type { BrowserLaunchOptions } from 'agent-browser';
import type { Page } from 'playwright-core';
import type { BrowserConfig } from './types';

/**
 * Extended session info for AgentBrowser.
 */
interface AgentBrowserSession extends ThreadSession {
  /** For 'thread' scope: dedicated browser manager instance */
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
 * Supports two scope modes:
 * - 'shared': All threads share the shared browser manager
 * - 'thread': Each thread gets a dedicated browser manager instance
 */
export class AgentBrowserThreadManager extends ThreadManager<BrowserManager> {
  private readonly browserConfig: BrowserConfig;
  private readonly resolveCdpUrl?: (cdpUrl: string | (() => string | Promise<string>)) => Promise<string>;
  private readonly onBrowserCreated?: (manager: BrowserManager, threadId: string) => void;

  constructor(config: AgentBrowserThreadManagerConfig) {
    super(config);
    this.browserConfig = config.browserConfig;
    this.resolveCdpUrl = config.resolveCdpUrl;
    this.onBrowserCreated = config.onBrowserCreated;
  }

  /**
   * Get the page for a specific thread, creating session if needed.
   */
  async getPageForThread(threadId?: string): Promise<Page> {
    const manager = await this.getManagerForThread(threadId);
    return manager.getPage();
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

    if (this.scope === 'thread') {
      // Thread scope - create a new browser manager for this thread
      const manager = new BrowserManager();

      const launchOptions: BrowserLaunchOptions = {
        headless: this.browserConfig.headless,
        viewport: this.browserConfig.viewport,
        profile: this.browserConfig.profile,
        executablePath: this.browserConfig.executablePath,
        storageState: this.browserConfig.storageState,
      };

      if (this.browserConfig.cdpUrl && this.resolveCdpUrl) {
        launchOptions.cdpUrl = await this.resolveCdpUrl(this.browserConfig.cdpUrl);
      }

      try {
        await manager.launch(launchOptions);
      } catch (error) {
        // Clean up manager on launch failure
        try {
          await manager.close();
        } catch {
          // Ignore close errors - launch already failed
        }
        throw error;
      }

      session.manager = manager;
      this.threadManagers.set(threadId, manager);

      try {
        // Restore browser state if available (before notifying parent to avoid screencast race)
        if (savedState && savedState.tabs.length > 0) {
          this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
          await this.restoreBrowserState(manager, savedState);
        }

        // Notify parent browser so it can set up close listeners
        // This is done after restoration so the screencast starts on the correct active page
        this.onBrowserCreated?.(manager, threadId);
      } catch (error) {
        // Roll back: remove from tracking and close the manager
        this.threadManagers.delete(threadId);
        session.manager = undefined;
        try {
          await manager.close();
        } catch {
          // Ignore close errors during rollback
        }
        throw error;
      }
    }
    // For 'shared' scope, no session setup needed - all threads share the manager

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

      // Switch to the active tab (always switch after opening tabs since newTab() changes active)
      if (state.tabs.length > 1 && state.activeTabIndex >= 0 && state.activeTabIndex < state.tabs.length) {
        await manager.switchTo(state.activeTabIndex);
      }
    } catch (error) {
      this.logger?.warn?.(`Failed to restore browser state: ${error}`);
    }
  }

  /**
   * Get the browser manager for a specific session.
   */
  protected getManagerForSession(session: AgentBrowserSession): BrowserManager {
    if (this.scope === 'thread' && session.manager) {
      return session.manager;
    }
    return this.getSharedManager();
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected async doDestroySession(session: AgentBrowserSession): Promise<void> {
    if (this.scope === 'thread' && session.manager) {
      // Close the dedicated browser manager
      await session.manager.close();
    }
    // For 'shared' scope, nothing to clean up - all threads share the manager
  }

  /**
   * Destroy all sessions (called during browser close).
   * doDestroySession handles closing individual browser managers.
   */
  override async destroyAllSessions(): Promise<void> {
    await super.destroyAllSessions();
  }
}
