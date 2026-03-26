/**
 * AgentBrowserThreadManager - Thread isolation for AgentBrowser
 *
 * Manages thread-scoped browser sessions using agent-browser's
 * BrowserManager capabilities (newWindow, switchTo, closeTab).
 */

import { ThreadManager } from '@mastra/core/browser';
import type { ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';
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
}

/**
 * Thread manager implementation for AgentBrowser.
 *
 * Supports three isolation modes:
 * - 'none': All threads share the shared browser manager
 * - 'context': Each thread gets a new window (BrowserContext) in the shared browser
 * - 'browser': Each thread gets a dedicated browser manager instance
 */
export class AgentBrowserThreadManager extends ThreadManager<BrowserManager> {
  private sharedManager: BrowserManager | null = null;
  private readonly browserConfig: BrowserConfig;
  private readonly resolveCdpUrl?: (cdpUrl: string | (() => string | Promise<string>)) => Promise<string>;

  /** Map of thread ID to dedicated browser manager (for 'browser' mode) */
  private readonly threadBrowsers = new Map<string, BrowserManager>();

  constructor(config: AgentBrowserThreadManagerConfig) {
    super(config);
    this.browserConfig = config.browserConfig;
    this.resolveCdpUrl = config.resolveCdpUrl;
  }

  /**
   * Set the shared browser manager (called after browser launch).
   */
  setSharedManager(manager: BrowserManager): void {
    this.sharedManager = manager;
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
    const session: AgentBrowserSession = {
      threadId,
      createdAt: Date.now(),
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
    } else if (this.isolation === 'context') {
      // Context isolation - create a new window in the shared browser
      const manager = this.getSharedManager();
      if (!manager.newWindow) {
        throw new Error('Browser manager does not support newWindow() for context isolation');
      }
      const { index } = await manager.newWindow();
      session.pageIndex = index;
    }

    return session;
  }

  /**
   * Switch to an existing session.
   */
  protected async switchToSession(session: AgentBrowserSession): Promise<void> {
    if (this.isolation === 'context' && session.pageIndex !== undefined) {
      const manager = this.getSharedManager();
      if (!manager.switchTo) {
        throw new Error('Browser manager does not support switchTo() for context isolation');
      }
      await manager.switchTo(session.pageIndex);
    }
    // For 'browser' mode, no switching needed - each thread has its own manager
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
    } else if (this.isolation === 'context' && session.pageIndex !== undefined) {
      // Close the context/window in the shared browser
      const manager = this.getSharedManager();
      if (manager.closeTab) {
        await manager.closeTab(session.pageIndex);
      }
    }
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
}
