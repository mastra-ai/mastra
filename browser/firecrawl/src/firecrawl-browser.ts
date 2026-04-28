import type { AgentBrowserConfig } from '@mastra/agent-browser';
import { AgentBrowser } from '@mastra/agent-browser';
import { Firecrawl } from '@mendable/firecrawl-js';
import type { BrowserLaunchOptions } from 'agent-browser';
import { BrowserManager } from 'agent-browser';
import { FirecrawlAgentBrowserThreadManager } from './firecrawl-thread-manager';
import { resolveCdpWebSocketUrl } from './resolve-cdp';
import type { FirecrawlBrowserConfig, FirecrawlBrowserSessionOptions } from './types';

function pickSessionOpts(c: FirecrawlBrowserConfig): FirecrawlBrowserSessionOptions {
  return c.firecrawl ?? {};
}

function toBaseConfig(config: FirecrawlBrowserConfig): AgentBrowserConfig {
  const { apiKey: _a, apiUrl: _u, firecrawl: _f, ...rest } = config;
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
        }),
    });
    this.firecrawl = fc;
    this.sessionOpts = sessionOpts;
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
          await this.firecrawl.deleteBrowser(createRes.id);
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
        viewport: localConfig.viewport,
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
        await this.firecrawl.deleteBrowser(sessionId);
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
        await this.firecrawl.deleteBrowser(sid);
      } catch (err) {
        this.logger?.warn?.(`Firecrawl deleteBrowser(${sid}) failed: ${err}`);
      }
      this.sharedFirecrawlSessionId = undefined;
    }
  }
}
