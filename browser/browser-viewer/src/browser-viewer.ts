/**
 * BrowserViewer - Playwright-managed Chrome for CLI providers
 *
 * Launches Chrome via Playwright and exposes the CDP URL for CLI tools
 * (agent-browser, browser-use, browse-cli) to connect as secondary clients.
 *
 * This gives us:
 * - Direct page-level CDP sessions (fixes screencast sessionId issues)
 * - Full browser lifecycle control
 * - Predictable CDP URL for CLI injection
 */

import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page, CDPSession } from 'playwright-core';
import {
  MastraBrowser,
  ScreencastStreamImpl,
  DEFAULT_THREAD_ID,
} from '@mastra/core/browser';
import type {
  BrowserState,
  BrowserTabState,
  ScreencastOptions,
  ScreencastStream,
  CdpSessionProvider,
  CdpSessionLike,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { BrowserViewerConfig, CLIProvider } from './types';

/**
 * BrowserViewer - CLI provider with Playwright-managed Chrome
 *
 * Use this with Workspace to enable browser automation via CLI tools.
 * The agent uses skills + workspace_execute_command to drive the CLI,
 * while Mastra handles screencast, input injection, and lifecycle.
 *
 * @example
 * ```ts
 * import { Workspace } from '@mastra/core';
 * import { BrowserViewer } from '@mastra/browser-viewer';
 *
 * const workspace = new Workspace({
 *   browser: new BrowserViewer({
 *     cli: 'agent-browser',
 *     headless: false,
 *   }),
 * });
 * ```
 */
export class BrowserViewer extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'BrowserViewer';
  override readonly provider = 'browser-viewer';
  override readonly providerType = 'cli' as const;

  /** Playwright browser instance */
  private browser: Browser | null = null;

  /** Browser context */
  private context: BrowserContext | null = null;

  /** CDP session for the active page */
  private cdpSession: CDPSession | null = null;

  /** CDP WebSocket URL (either discovered from launched browser or provided in config) */
  private _cdpUrl: string | null = null;

  /** Which CLI the agent uses */
  readonly cli: CLIProvider;

  /** Viewer-specific config */
  private readonly viewerConfig: BrowserViewerConfig;

  constructor(config: BrowserViewerConfig) {
    super({
      ...config,
      // BrowserViewer always uses shared scope (single browser for all threads)
      scope: 'shared',
    });

    this.id = `browser-viewer-${Date.now()}`;
    this.cli = config.cli;
    this.viewerConfig = config;
  }

  // ---------------------------------------------------------------------------
  // CDP URL Access
  // ---------------------------------------------------------------------------

  /**
   * Get the CDP WebSocket URL for CLI tools to connect.
   * Returns null if browser is not running.
   */
  override getCdpUrl(): string | null {
    return this._cdpUrl;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (implements MastraBrowser abstract methods)
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
    const cdpUrl = this.config.cdpUrl;
    if (cdpUrl) {
      // Connect mode: connect to existing browser
      const url = typeof cdpUrl === 'function' ? await cdpUrl() : cdpUrl;
      await this.connectToExisting(url);
    } else {
      // Launch mode: start our own Chrome
      await this.launchChrome();
    }
  }

  protected override async doClose(): Promise<void> {
    // Clean up CDP session
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch {
        // Ignore detach errors
      }
      this.cdpSession = null;
    }

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
      this.context = null;
    }

    this._cdpUrl = null;
  }

  /**
   * Connect to an existing browser via CDP URL.
   */
  private async connectToExisting(cdpUrl: string): Promise<void> {
    this.logger?.debug?.(`Connecting to existing browser at ${cdpUrl}`);

    this.browser = await chromium.connectOverCDP(cdpUrl);
    this._cdpUrl = cdpUrl;

    // Get or create context
    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? await this.browser.newContext();

    // Create initial page if none exists
    const pages = this.context.pages();
    if (pages.length === 0) {
      await this.context.newPage();
    }

    // Set up CDP session for active page
    await this.setupCdpSession();

    this.logger?.debug?.('Connected to existing browser');
  }

  /**
   * Launch Chrome via Playwright.
   */
  private async launchChrome(): Promise<void> {
    const port = this.viewerConfig.cdpPort ?? 0;

    this.logger?.debug?.(`Launching Chrome with remote-debugging-port=${port}`);

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.viewerConfig.headless ?? false,
      args: [
        `--remote-debugging-port=${port}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    };

    // Use custom executable if provided
    if (this.viewerConfig.executablePath) {
      launchOptions.executablePath = this.viewerConfig.executablePath;
    }

    // Use custom user data dir if provided
    // Note: For persistent context, we'd use launchPersistentContext
    // For now, we use launch() which creates a temporary profile

    this.browser = await chromium.launch(launchOptions);

    // Extract CDP URL from browser
    // Playwright exposes this via browser.wsEndpoint() but that's the Playwright endpoint
    // We need the Chrome DevTools endpoint
    this._cdpUrl = this.extractCdpUrl();

    // Create context and initial page
    this.context = await this.browser.newContext({
      viewport: this.viewerConfig.viewport ?? { width: 1280, height: 720 },
    });

    await this.context.newPage();

    // Set up CDP session for active page
    await this.setupCdpSession();

    // Set up close listener
    this.browser.on('disconnected', () => {
      this.handleBrowserDisconnected();
    });

    this.logger?.debug?.(`Chrome launched, CDP URL: ${this._cdpUrl}`);
  }

  /**
   * Extract the Chrome DevTools Protocol URL from the launched browser.
   */
  private extractCdpUrl(): string {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }

    // Playwright's wsEndpoint() returns the Playwright debugging endpoint
    // which is also a valid CDP endpoint
    const wsEndpoint = (this.browser as Browser & { wsEndpoint?: () => string }).wsEndpoint?.();

    if (wsEndpoint) {
      return wsEndpoint;
    }

    // Fallback: this shouldn't happen with chromium.launch()
    throw new Error('Could not extract CDP URL from browser');
  }

  /**
   * Set up CDP session for the active page.
   */
  private async setupCdpSession(): Promise<void> {
    const page = await this.getActivePage();
    if (!page) {
      return;
    }

    // Create CDP session directly on the page
    this.cdpSession = await (page as Page).context().newCDPSession(page as Page);
  }

  /**
   * Handle browser disconnection.
   * Overrides base class method.
   */
  override handleBrowserDisconnected(): void {
    this.logger?.debug?.('Browser disconnected');
    this.browser = null;
    this.context = null;
    this.cdpSession = null;
    this._cdpUrl = null;
    // Call parent to handle status and notifications
    super.handleBrowserDisconnected();
  }

  // ---------------------------------------------------------------------------
  // Browser State (implements MastraBrowser abstract methods)
  // ---------------------------------------------------------------------------

  protected override async getActivePage(_threadId?: string): Promise<Page | null> {
    if (!this.context) {
      return null;
    }

    const pages = this.context.pages();
    return pages[0] ?? null;
  }

  protected override getBrowserStateForThread(_threadId?: string): BrowserState | null {
    if (!this.context) {
      return null;
    }

    const pages = this.context.pages();
    const tabs: BrowserTabState[] = pages.map((page, index) => ({
      url: page.url(),
      title: '', // Would need async call to get title
      isActive: index === 0,
    }));

    return {
      tabs,
      activeTabIndex: 0,
    };
  }

  override isBrowserRunning(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  // ---------------------------------------------------------------------------
  // Screencast (overrides MastraBrowser)
  // ---------------------------------------------------------------------------

  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    const page = await this.getActivePage();
    if (!page) {
      throw new Error('No active page for screencast');
    }

    // Create fresh CDP session for screencast
    const cdpSession = await (page as Page).context().newCDPSession(page as Page);

    // Create provider that returns the CDP session
    const provider: CdpSessionProvider = {
      getCdpSession: async () => cdpSession as unknown as CdpSessionLike,
      isBrowserRunning: () => this.isBrowserRunning(),
    };

    const stream = new ScreencastStreamImpl(provider, options);

    // Store stream for potential reconnection
    const streamKey = this.getStreamKey(DEFAULT_THREAD_ID);
    this.activeScreencastStreams.set(streamKey, stream);

    await stream.start();

    // Clean up on stop
    stream.once('stop', () => {
      if (this.activeScreencastStreams.get(streamKey) === stream) {
        this.activeScreencastStreams.delete(streamKey);
      }
      cdpSession.detach().catch(() => {});
    });

    return stream;
  }

  // ---------------------------------------------------------------------------
  // Input Injection (overrides MastraBrowser)
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(params: MouseEventParams, _threadId?: string): Promise<void> {
    if (!this.cdpSession) {
      await this.setupCdpSession();
    }

    if (!this.cdpSession) {
      throw new Error('No CDP session available for input injection');
    }

    await this.cdpSession.send('Input.dispatchMouseEvent', {
      type: params.type,
      x: params.x,
      y: params.y,
      button: params.button ?? 'left',
      clickCount: params.clickCount ?? 1,
      deltaX: params.deltaX ?? 0,
      deltaY: params.deltaY ?? 0,
      modifiers: params.modifiers ?? 0,
    });
  }

  override async injectKeyboardEvent(params: KeyboardEventParams, _threadId?: string): Promise<void> {
    if (!this.cdpSession) {
      await this.setupCdpSession();
    }

    if (!this.cdpSession) {
      throw new Error('No CDP session available for input injection');
    }

    await this.cdpSession.send('Input.dispatchKeyEvent', {
      type: params.type,
      key: params.key,
      code: params.code,
      text: params.text,
      modifiers: params.modifiers ?? 0,
      windowsVirtualKeyCode: params.windowsVirtualKeyCode,
    });
  }

  // ---------------------------------------------------------------------------
  // Tools (implements MastraBrowser abstract method)
  // ---------------------------------------------------------------------------

  /**
   * BrowserViewer doesn't provide its own tools.
   * The agent uses CLI tools via workspace_execute_command.
   */
  override getTools(): Record<string, Tool<any, any>> {
    return {};
  }
}
