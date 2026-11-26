import { AgentBrowserThreadManager, BrowserManager } from '@mastra/agent-browser';
import type { AgentBrowserSession, AgentBrowserThreadManagerConfig, BrowserLaunchOptions } from '@mastra/agent-browser';
import { DEFAULT_BROWSER_VIEWPORT, resolveViewportSize } from '@mastra/core/browser';
import type { PlatformBrowserSessions } from './sessions';

interface PlatformThreadSession extends AgentBrowserSession {
  platformSessionId?: string;
}

export interface PlatformBrowserThreadManagerConfig extends AgentBrowserThreadManagerConfig {
  sessions: PlatformBrowserSessions;
}

/** Gives each thread its own hosted browser, and ends it when the thread's browser closes. */
export class PlatformBrowserThreadManager extends AgentBrowserThreadManager {
  readonly #sessions: PlatformBrowserSessions;

  constructor(config: PlatformBrowserThreadManagerConfig) {
    super(config);
    this.#sessions = config.sessions;
  }

  protected override async createSession(threadId: string) {
    if (this.scope !== 'thread') return super.createSession(threadId);

    const savedState = this.getSavedBrowserState(threadId);
    const session: PlatformThreadSession = { threadId, createdAt: Date.now(), browserState: savedState };
    const opened = await this.#sessions.open();
    session.platformSessionId = opened.id;

    const manager = new BrowserManager();
    const launchOptions: BrowserLaunchOptions = {
      headless: this.browserConfig.headless ?? true,
      // The browser is remote, so there is no local window to size to.
      viewport: resolveViewportSize(this.browserConfig.viewport) ?? DEFAULT_BROWSER_VIEWPORT,
      storageState: this.browserConfig.storageState,
      cdpUrl: opened.cdpUrl,
    };

    try {
      await manager.launch(launchOptions);
      session.manager = manager;
      this.threadManagers.set(threadId, manager);
      await this.onBrowserOpened?.(threadId);
      if (savedState && savedState.tabs.length > 0) await this.restoreBrowserState(manager, savedState);
      this.onBrowserCreated?.(manager, threadId);
    } catch (error) {
      this.threadManagers.delete(threadId);
      await manager.close().catch(() => {});
      await this.#sessions.end(opened.id).catch(() => {});
      throw error;
    }
    return session;
  }

  protected override async doDestroySession(session: PlatformThreadSession): Promise<void> {
    if (this.scope === 'thread' && session.manager) {
      await session.manager.close().catch(() => {});
      this.threadManagers.delete(session.threadId);
    }
    if (session.platformSessionId) {
      await this.#sessions.end(session.platformSessionId).catch(error => {
        this.logger?.warn?.(`PlatformBrowser: couldn't end browser ${session.platformSessionId}: ${error}`);
      });
    }
  }
}
