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
 * Supports two isolation modes:
 * - 'none': All threads share the shared browser manager
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
    }
    // For 'none' isolation, no session setup needed - all threads share the manager

    return session;
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
}
