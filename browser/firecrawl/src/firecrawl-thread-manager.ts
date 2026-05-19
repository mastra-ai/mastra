import type { AgentBrowserSession, AgentBrowserThreadManagerConfig } from '@mastra/agent-browser';
import { AgentBrowserThreadManager } from '@mastra/agent-browser';
import type { Firecrawl } from '@mendable/firecrawl-js';
import type { BrowserLaunchOptions } from 'agent-browser';
import { BrowserManager } from 'agent-browser';
import type { FirecrawlBrowserSessionOptions } from './types';

/**
 * Thread session with Firecrawl sandbox id for cleanup.
 */
export interface FirecrawlAgentBrowserSession extends AgentBrowserSession {
  firecrawlSessionId?: string;
}

export interface FirecrawlAgentBrowserThreadManagerConfig extends AgentBrowserThreadManagerConfig {
  firecrawl: Firecrawl;
  /** Resolve HTTP CDP URL to WebSocket URL. */
  resolveWebSocketUrl: (url: string) => Promise<string>;
  /** Options for each `firecrawl.browser()` call (thread scope = one call per thread). */
  sessionOptions?: FirecrawlBrowserSessionOptions;
}

/**
 * Provisions a dedicated Firecrawl Browser Sandbox session per Mastra thread and connects Playwright over CDP.
 */
export class FirecrawlAgentBrowserThreadManager extends AgentBrowserThreadManager {
  private readonly firecrawl: Firecrawl;
  private readonly resolveWebSocketUrl: (url: string) => Promise<string>;
  private readonly sessionOptions: FirecrawlBrowserSessionOptions;

  constructor(config: FirecrawlAgentBrowserThreadManagerConfig) {
    super(config);
    this.firecrawl = config.firecrawl;
    this.resolveWebSocketUrl = config.resolveWebSocketUrl;
    this.sessionOptions = config.sessionOptions ?? {};
  }

  protected override async createSession(threadId: string): Promise<FirecrawlAgentBrowserSession> {
    const savedState = this.getSavedBrowserState(threadId);

    const session: FirecrawlAgentBrowserSession = {
      threadId,
      createdAt: Date.now(),
      browserState: savedState,
    };

    if (this.scope === 'thread') {
      const createRes = await this.firecrawl.browser({
        ttl: this.sessionOptions.ttl,
        activityTtl: this.sessionOptions.activityTtl,
        streamWebView: this.sessionOptions.streamWebView,
        profile: this.sessionOptions.profile,
        integration: this.sessionOptions.integration,
        origin: this.sessionOptions.origin,
      });

      if (!createRes.success || !createRes.id || !createRes.cdpUrl) {
        const msg = createRes.error ?? 'Firecrawl browser session creation failed';
        const err = new Error(`Firecrawl browser(): ${msg}`);
        if (createRes.id) {
          try {
            await this.firecrawl.deleteBrowser(createRes.id);
          } catch (cleanupErr) {
            this.logger?.warn?.(`Firecrawl deleteBrowser(${createRes.id}) after failed browser(): ${cleanupErr}`);
          }
        }
        throw err;
      }

      session.firecrawlSessionId = createRes.id;

      const manager = new BrowserManager();

      const wsUrl = await this.resolveWebSocketUrl(createRes.cdpUrl);

      const launchOptions: BrowserLaunchOptions = {
        headless: this.browserConfig.headless ?? true,
        viewport: this.browserConfig.viewport,
        profile: this.browserConfig.profile,
        executablePath: this.browserConfig.executablePath,
        storageState: this.browserConfig.storageState,
        cdpUrl: wsUrl,
      };

      try {
        await manager.launch(launchOptions);
      } catch (error) {
        try {
          await manager.close();
        } catch {
          // ignore
        }
        try {
          await this.firecrawl.deleteBrowser(createRes.id);
        } catch {
          // ignore
        }
        throw error;
      }

      session.manager = manager;
      this.threadManagers.set(threadId, manager);

      try {
        if (savedState && savedState.tabs.length > 0) {
          this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
          await this.restoreBrowserState(manager, savedState);
        }
        this.onBrowserCreated?.(manager, threadId);
      } catch (error) {
        this.threadManagers.delete(threadId);
        session.manager = undefined;
        try {
          await manager.close();
        } catch {
          // ignore
        }
        if (session.firecrawlSessionId) {
          try {
            await this.firecrawl.deleteBrowser(session.firecrawlSessionId);
          } catch {
            // ignore
          }
        }
        throw error;
      }
    }

    return session;
  }

  protected override async doDestroySession(session: FirecrawlAgentBrowserSession): Promise<void> {
    if (this.scope === 'thread' && session.manager) {
      try {
        await session.manager.close();
      } catch {
        // ignore
      }
      this.threadManagers.delete(session.threadId);
    }

    if (session.firecrawlSessionId) {
      try {
        await this.firecrawl.deleteBrowser(session.firecrawlSessionId);
      } catch {
        // ignore
      }
    }
  }
}
