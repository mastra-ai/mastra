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
 * - Thread-scoped browser isolation
 */

import { MastraBrowser, ScreencastStreamImpl } from '@mastra/core/browser';
import type {
  BrowserState,
  BrowserTabState,
  ScreencastOptions,
  ScreencastStream,
  CdpSessionProvider,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { Page } from 'playwright-core';
import { BrowserViewerThreadManager } from './thread-manager';
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
  readonly providerType = 'cli' as const;

  /** Which CLI the agent uses */
  readonly cli: CLIProvider;

  /** Viewer-specific config (stored for reference) */
  readonly viewerConfig: BrowserViewerConfig;

  /** Thread manager for browser sessions */
  declare protected threadManager: BrowserViewerThreadManager;

  constructor(config: BrowserViewerConfig) {
    // Default to 'thread' scope (each thread gets its own Chrome)
    // Use 'shared' if connecting to an existing browser
    const effectiveScope = config.cdpUrl ? (config.scope ?? 'shared') : (config.scope ?? 'thread');

    // Build base config (exclude CLI-specific options)
    // Use type assertion because BrowserConfig is a discriminated union
    const { cli: _cli, cdpPort: _cdpPort, ...baseConfig } = config;

    super({
      ...baseConfig,
      scope: effectiveScope,
    } as any);

    this.id = `browser-viewer-${Date.now()}`;
    this.cli = config.cli;
    this.viewerConfig = config;

    // Initialize thread manager
    this.threadManager = new BrowserViewerThreadManager({
      scope: effectiveScope,
      browserConfig: { ...config, headless: this.headless },
      logger: this.logger,
      onSessionCreated: session => {
        // Notify listeners so screencast can start for this thread
        this.notifyBrowserReady(session.threadId);
      },
      onBrowserCreated: (_browser, threadId, _cdpUrl) => {
        this.logger?.debug?.(`Browser created for thread ${threadId}`);
      },
      onBrowserClosed: threadId => {
        this.logger?.debug?.(`Browser closed for thread ${threadId}`);
        // Notify base class callbacks so ViewerRegistry gets notified
        this.notifyBrowserClosed(threadId);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // CDP URL Access
  // ---------------------------------------------------------------------------

  /**
   * Get the CDP WebSocket URL for CLI tools to connect.
   * For thread scope, returns the CDP URL for the specified thread.
   * For shared scope, returns the single shared CDP URL.
   *
   * @param threadId - Thread identifier (optional, uses current thread if not specified)
   * @returns CDP URL or null if browser not running for that thread
   */
  override getCdpUrl(threadId?: string): string | null {
    return this.threadManager.getCdpUrlForThread(threadId ?? this.getCurrentThread());
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (implements MastraBrowser abstract methods)
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
    const scope = this.threadManager.getScope();
    const cdpUrl = this.config.cdpUrl;

    if (cdpUrl) {
      // Connect mode: connect to existing browser (always shared)
      const url = typeof cdpUrl === 'function' ? await cdpUrl() : cdpUrl;
      await this.connectToExisting(url);
    } else if (scope === 'shared') {
      // Shared mode: launch single browser
      await this.threadManager.createSharedSession();
    }
    // For thread scope, browsers are launched lazily per thread via ensureReady()
  }

  protected override async doClose(): Promise<void> {
    await this.threadManager.closeAll();
  }

  /**
   * Connect to an existing browser via CDP URL.
   */
  private async connectToExisting(cdpUrl: string): Promise<void> {
    this.logger?.debug?.(`Connecting to existing browser at ${cdpUrl}`);

    // Create a shared session from the external CDP connection
    await this.threadManager.createSharedSessionFromCdp(cdpUrl);

    this.logger?.debug?.('Connected to existing browser');
  }

  /**
   * Ensure browser is ready for the current thread.
   * For thread scope, creates a new browser if needed.
   */
  override async ensureReady(): Promise<void> {
    const scope = this.threadManager.getScope();
    const threadId = this.getCurrentThread();

    // For thread scope, create browser for this thread if needed
    if (scope === 'thread' && !this.threadManager.isBrowserRunning(threadId)) {
      await this.threadManager.getManagerForThread(threadId);
    }

    await super.ensureReady();
  }

  /**
   * Check if browser is running (for current thread in thread scope).
   */
  override isBrowserRunning(threadId?: string): boolean {
    return this.threadManager.isBrowserRunning(threadId ?? this.getCurrentThread());
  }

  /**
   * Launch browser, optionally for a specific thread.
   * For thread scope, creates a browser for that thread.
   * For shared scope, launches the single shared browser.
   */
  override async launch(threadId?: string): Promise<void> {
    const scope = this.threadManager.getScope();
    const effectiveThreadId = threadId ?? this.getCurrentThread();

    if (scope === 'shared') {
      // For shared scope, use base class launch (handles racing, status, etc.)
      if (!this.threadManager.isBrowserRunning()) {
        await super.launch();
      }
    } else {
      // For thread scope, launch for this specific thread
      if (!this.threadManager.isBrowserRunning(effectiveThreadId)) {
        await this.threadManager.getManagerForThread(effectiveThreadId);
        // Set status to ready so isBrowserRunning() returns true
        // (base class launch() does this, but we bypass it for thread scope)
        this.status = 'ready';
      }
    }
  }

  /**
   * Handle browser disconnection.
   * Overrides base class method.
   */
  override handleBrowserDisconnected(): void {
    // Call parent to handle status and notifications
    super.handleBrowserDisconnected();
  }

  /**
   * Connect to an external browser via CDP URL for screencast.
   *
   * Use this when an agent is using their own external CDP (e.g., browser-use cloud).
   * Connects Playwright to the external browser to enable screencast without launching
   * our own browser.
   *
   * @param cdpUrl - The external CDP WebSocket URL (wss://... or ws://...)
   * @param threadId - Thread ID to associate the session with
   */
  override async connectToExternalCdp(cdpUrl: string, threadId?: string): Promise<void> {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    await this.threadManager.connectToExternalCdp(cdpUrl, effectiveThreadId);
    // Mark as ready
    this.status = 'ready';
  }

  // ---------------------------------------------------------------------------
  // Browser State (implements MastraBrowser abstract methods)
  // ---------------------------------------------------------------------------

  protected override async getActivePage(threadId?: string): Promise<Page | null> {
    return this.threadManager.getActivePageForThread(threadId ?? this.getCurrentThread());
  }

  protected override getBrowserStateForThread(threadId?: string): BrowserState | null {
    const context = this.threadManager.getContextForThread(threadId ?? this.getCurrentThread());
    if (!context) {
      return null;
    }

    const pages = context.pages();
    // Active page is the last one (most recently opened), consistent with resolveActivePage
    const activeIndex = pages.length > 0 ? pages.length - 1 : 0;
    const tabs: BrowserTabState[] = pages.map((page, index) => ({
      url: page.url(),
      title: '', // Would need async call to get title
      isActive: index === activeIndex,
    }));

    return {
      tabs,
      activeTabIndex: activeIndex,
    };
  }

  // ---------------------------------------------------------------------------
  // Screencast Support
  // ---------------------------------------------------------------------------

  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    const threadId = options?.threadId ?? this.getCurrentThread();

    // Create CDP session provider that creates FRESH sessions on each call
    // This is critical for tab switching - when reconnecting, we need a CDP session
    // attached to the CURRENT page, not the original page from launch
    const provider: CdpSessionProvider = {
      getCdpSession: async () => {
        const cdpSession = await this.threadManager.createFreshCdpSession(threadId);
        if (!cdpSession) {
          throw new Error('No browser context available for screencast');
        }

        // Return wrapper that implements CdpSessionLike
        return {
          send: async (method: string, params?: Record<string, unknown>) => {
            return cdpSession.send(method as any, params);
          },
          on: (event: string, handler: (params: unknown) => void) => {
            cdpSession.on(event as any, handler);
          },
          off: (event: string, handler: (params: unknown) => void) => {
            cdpSession.off(event as any, handler);
          },
        };
      },
      isBrowserRunning: () => this.isBrowserRunning(threadId),
    };

    // Create and start screencast stream
    const stream = new ScreencastStreamImpl(provider, {
      format: options?.format ?? 'jpeg',
      quality: options?.quality ?? 80,
      maxWidth: options?.maxWidth ?? 1280,
      maxHeight: options?.maxHeight ?? 720,
      everyNthFrame: options?.everyNthFrame ?? 1,
    });

    // Set up tab change detection - reconnect screencast when tabs change
    const context = this.threadManager.getContextForThread(threadId);
    if (context) {
      // Track all listeners for cleanup
      const pageListeners = new Map<Page, (frame: { url: () => string; parentFrame: () => unknown }) => void>();

      // New tab opened - reconnect screencast
      const onNewPage = () => {
        setTimeout(() => {
          if (stream.isActive()) {
            stream.reconnect().catch(() => {});
          }
        }, 100);
      };

      // Handler for new pages that sets up listeners
      const onPageCreated = (page: Page) => {
        setupPageListeners(page);
      };

      // Set up page close listener for each page
      const setupPageListeners = (page: Page) => {
        page.once('close', () => {
          // Clean up this page's listener
          pageListeners.delete(page);
          setTimeout(() => {
            if (stream.isActive() && context.pages().length > 0) {
              stream.reconnect().catch(() => {});
            }
          }, 100);
        });

        // Navigation listener for URL updates
        const onFrameNavigated = (frame: { url: () => string; parentFrame: () => unknown }) => {
          if (!frame.parentFrame()) {
            stream.emitUrl(frame.url());
          }
        };
        page.on('framenavigated', onFrameNavigated);
        pageListeners.set(page, onFrameNavigated);
      };

      // Set up listeners
      context.on('page', onNewPage);
      context.on('page', onPageCreated);

      // Set up for existing pages
      for (const page of context.pages()) {
        setupPageListeners(page);
      }

      // Clean up all listeners on stream stop
      stream.once('stop', () => {
        context.off('page', onNewPage);
        context.off('page', onPageCreated);
        // Remove framenavigated listeners from all pages
        for (const [page, listener] of pageListeners) {
          page.off('framenavigated', listener);
        }
        pageListeners.clear();
      });
    }

    await stream.start();
    return stream;
  }

  // ---------------------------------------------------------------------------
  // Input Injection
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(params: MouseEventParams, threadId?: string): Promise<void> {
    const cdpSession = await this.threadManager.getCdpSessionForThread(threadId ?? this.getCurrentThread());
    if (!cdpSession) {
      throw new Error('CDP session not available for mouse injection');
    }

    await cdpSession.send('Input.dispatchMouseEvent', params);
  }

  override async injectKeyboardEvent(params: KeyboardEventParams, threadId?: string): Promise<void> {
    const cdpSession = await this.threadManager.getCdpSessionForThread(threadId ?? this.getCurrentThread());
    if (!cdpSession) {
      throw new Error('CDP session not available for keyboard injection');
    }

    await cdpSession.send('Input.dispatchKeyEvent', params);
  }

  // ---------------------------------------------------------------------------
  // Tools (CLI agents don't use SDK tools - they use workspace commands)
  // ---------------------------------------------------------------------------

  getTools(): Record<string, Tool> {
    // CLI agents use workspace_execute_command with CLI skills
    // No SDK tools needed
    return {};
  }
}
