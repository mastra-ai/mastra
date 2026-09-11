import type { AgentBrowserConfig } from '@mastra/agent-browser';
import { AgentBrowser } from '@mastra/agent-browser';
import { resolveViewportSize, DEFAULT_BROWSER_VIEWPORT } from '@mastra/core/browser';
import type { BrowserLaunchOptions } from 'agent-browser';
import { BrowserManager } from 'agent-browser';
import { Firecrawl } from 'firecrawl';
import { FirecrawlAgentBrowserThreadManager } from './firecrawl-thread-manager';
import { resolveCdpWebSocketUrl } from './resolve-cdp';
import type {
  FirecrawlBrowserConfig,
  FirecrawlBrowserSessionDeletedHook,
  FirecrawlBrowserSessionOptions,
} from './types';

function pickSessionOpts(c: FirecrawlBrowserConfig): FirecrawlBrowserSessionOptions {
  return c.firecrawl ?? {};
}

function toBaseConfig(config: FirecrawlBrowserConfig): AgentBrowserConfig {
  const { apiKey: _a, apiUrl: _u, firecrawl: _f, onSessionDeleted: _d, ...rest } = config;
  return rest;
}

/**
 * Mastra browser provider backed by [Firecrawl Browser Sandbox](https://docs.firecrawl.dev/features/browser):
 * provisions remote sessions via API and drives them with the same deterministic tools as {@link AgentBrowser}.
 */
export class FirecrawlBrowser extends AgentBrowser {
  override readonly name = 'FirecrawlBrowser';
  override readonly provider = 'firecrawl/browser-sandbox';

  /** Narrowed from base `MastraBrowser` (`unknown`) — same pattern as {@link AgentBrowser}. */
  declare protected sharedManager: BrowserManager | null;

  private readonly firecrawl: Firecrawl;
  private readonly sessionOpts: FirecrawlBrowserSessionOptions;
  private readonly onSessionDeleted?: FirecrawlBrowserSessionDeletedHook;
  private sharedFirecrawlSessionId?: string;

  constructor(config: FirecrawlBrowserConfig) {
    const apiKey = config.apiKey ?? process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FirecrawlBrowser requires `apiKey` or FIRECRAWL_API_KEY');
    }
    const fc = new Firecrawl({ apiKey, apiUrl: config.apiUrl });
    const sessionOpts = pickSessionOpts(config);

    super({
      ...toBaseConfig(config),
      createThreadManager: opts =>
        new FirecrawlAgentBrowserThreadManager({
          ...opts,
          firecrawl: fc,
          resolveWebSocketUrl: url => resolveCdpWebSocketUrl(url, opts.logger),
          sessionOptions: sessionOpts,
          onSessionDeleted: config.onSessionDeleted,
        }),
    });
    this.firecrawl = fc;
    this.sessionOpts = sessionOpts;
    this.onSessionDeleted = config.onSessionDeleted;
  }

  private async deleteSession(sessionId: string): Promise<void> {
    const receipt = await this.firecrawl.deleteBrowser(sessionId);
    try {
      await this.onSessionDeleted?.({ sessionId, receipt });
    } catch (error) {
      this.logger?.warn?.(`Firecrawl onSessionDeleted(${sessionId}) failed: ${error}`);
    }
  }

  protected override async doLaunch(): Promise<void> {
    const scope = this.threadManager.getScope();
    if (scope === 'thread') {
      await super.doLaunch();
      return;
    }

    const createRes = await this.firecrawl.browser({
      ttl: this.sessionOpts.ttl,
      activityTtl: this.sessionOpts.activityTtl,
      streamWebView: this.sessionOpts.streamWebView,
      profile: this.sessionOpts.profile,
      integration: this.sessionOpts.integration,
      origin: this.sessionOpts.origin,
    });

    if (!createRes.success || !createRes.id || !createRes.cdpUrl) {
      const msg = createRes.error ?? 'Firecrawl browser session creation failed';
      const err = new Error(`Firecrawl browser(): ${msg}`);
      if (createRes.id) {
        try {
          await this.deleteSession(createRes.id);
        } catch (cleanupErr) {
          this.logger?.warn?.(`Firecrawl deleteBrowser(${createRes.id}) after failed browser(): ${cleanupErr}`);
        }
      }
      throw err;
    }

    const sessionId = createRes.id;
    this.sharedManager = new BrowserManager();

    try {
      const localConfig = this.config as AgentBrowserConfig;
      const wsUrl = await resolveCdpWebSocketUrl(createRes.cdpUrl, this.logger);

      const launchOptions: BrowserLaunchOptions = {
        headless: localConfig.headless ?? true,
        // Firecrawl drives a remote browser, so there is no local window to
        // match; `'window'` falls back to the default dimensions.
        viewport: resolveViewportSize(localConfig.viewport) ?? DEFAULT_BROWSER_VIEWPORT,
        profile: localConfig.profile,
        executablePath: localConfig.executablePath,
        storageState: localConfig.storageState,
        cdpUrl: wsUrl,
      };

      await this.sharedManager.launch(launchOptions);
      this.threadManager.setSharedManager(this.sharedManager);
      this.setupCloseListenerForSharedScope(this.sharedManager);
      this.sharedFirecrawlSessionId = sessionId;
    } catch (launchErr) {
      try {
        await this.sharedManager.close();
      } catch (closeErr) {
        this.logger?.warn?.(`BrowserManager.close() after failed shared launch: ${closeErr}`);
      }
      try {
        await this.deleteSession(sessionId);
      } catch (delErr) {
        this.logger?.warn?.(`Firecrawl deleteBrowser(${sessionId}) after failed shared launch: ${delErr}`);
      }
      this.sharedManager = null;
      this.sharedFirecrawlSessionId = undefined;
      throw launchErr;
    }
  }

  protected override async doClose(): Promise<void> {
    const sid = this.sharedFirecrawlSessionId;
    await super.doClose();
    if (sid) {
      try {
        await this.deleteSession(sid);
      } catch (err) {
        this.logger?.warn?.(`Firecrawl deleteBrowser(${sid}) failed: ${err}`);
      }
      this.sharedFirecrawlSessionId = undefined;
    }
  }
}
