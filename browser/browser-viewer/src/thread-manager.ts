/**
 * BrowserViewerThreadManager - Thread scope management for BrowserViewer
 *
 * Manages thread-scoped browser sessions using Playwright to launch
 * separate Chrome instances per thread.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ThreadManager, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type { ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, BrowserServer, CDPSession, Page } from 'playwright-core';
import type { BrowserViewerConfig } from './types';

/**
 * Extended session info for BrowserViewer.
 */
interface BrowserViewerSession extends ThreadSession {
  /**
   * Playwright browser server (owns the Chrome process).
   * Null for external CDP connections where we don't own the browser process.
   */
  browserServer: BrowserServer | null;
  /** Playwright browser instance (connected to server) */
  browser: Browser;
  /** Browser context */
  context: BrowserContext;
  /** CDP session for the active page */
  cdpSession: CDPSession | null;
  /** CDP WebSocket URL (null if discovery failed) */
  cdpUrl: string | null;
}

/**
 * Configuration for BrowserViewerThreadManager.
 */
export interface BrowserViewerThreadManagerConfig extends ThreadManagerConfig {
  /** Browser configuration */
  browserConfig: BrowserViewerConfig;
  /** Callback when a browser is created for a thread */
  onBrowserCreated?: (browser: Browser, threadId: string, cdpUrl: string | null) => void;
  /** Callback when a browser is closed for a thread */
  onBrowserClosed?: (threadId: string) => void;
}

/**
 * Thread manager implementation for BrowserViewer.
 *
 * Supports two scope modes:
 * - 'shared': All threads share one Chrome instance
 * - 'thread': Each thread gets a dedicated Chrome instance
 */
export class BrowserViewerThreadManager extends ThreadManager<Browser> {
  private readonly browserConfig: BrowserViewerConfig;
  private readonly onBrowserCreated?: (browser: Browser, threadId: string, cdpUrl: string | null) => void;
  private readonly onBrowserClosed?: (threadId: string) => void;

  /** Map of thread ID to session info (for 'thread' scope) */
  private readonly threadSessions = new Map<string, BrowserViewerSession>();

  /** Shared session info (for 'shared' scope) */
  private sharedSession: BrowserViewerSession | null = null;

  /** Cached CDP sessions for input injection, keyed by threadId */
  private inputCdpSessions = new Map<string, { session: CDPSession; pageUrl: string }>();

  constructor(config: BrowserViewerThreadManagerConfig) {
    super(config);
    this.browserConfig = config.browserConfig;
    this.onBrowserCreated = config.onBrowserCreated;
    this.onBrowserClosed = config.onBrowserClosed;
  }

  /**
   * Check if a thread should use the shared session slot.
   * In shared scope, all threads use the shared session.
   * In thread scope, DEFAULT_THREAD_ID also uses the shared session.
   */
  private usesSharedSlot(threadId: string): boolean {
    return this.scope === 'shared' || threadId === DEFAULT_THREAD_ID;
  }

  /**
   * Get the viewer session for a thread, using consistent routing.
   * Handles both shared and thread-scoped sessions.
   */
  private getViewerSession(threadId: string): BrowserViewerSession | null {
    if (this.usesSharedSlot(threadId)) {
      return this.sharedSession;
    }
    return this.threadSessions.get(threadId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Session Storage & Cleanup Helpers
  // ---------------------------------------------------------------------------

  /**
   * Store a session in the appropriate slot based on scope.
   * Consolidates session storage logic used by createSession, createSharedSession,
   * createSharedSessionFromCdp, and connectToExternalCdp.
   */
  private storeSession(session: BrowserViewerSession, threadId: string): void {
    if (this.usesSharedSlot(threadId)) {
      this.sharedSession = session;
      this.sessions.set(DEFAULT_THREAD_ID, session);
      this.setSharedManager(session.browser);
    } else {
      this.threadSessions.set(threadId, session);
      this.sessions.set(threadId, session);
      this.threadManagers.set(threadId, session.browser);
    }
  }

  /**
   * Clear a session from the appropriate slot based on scope.
   * Must be called BEFORE async cleanup operations to prevent double callbacks
   * from disconnect handlers.
   */
  private clearSessionState(threadId: string): void {
    if (this.usesSharedSlot(threadId)) {
      this.sharedSession = null;
      this.clearSharedManager();
      this.sessions.delete(DEFAULT_THREAD_ID);
    } else {
      this.threadSessions.delete(threadId);
      this.threadManagers.delete(threadId);
      this.sessions.delete(threadId);
    }
  }

  /**
   * Clean up a session's resources (CDP session, browser, server).
   * Consolidates cleanup logic used by closeThreadBrowser, closeSharedBrowser,
   * and doDestroySession.
   *
   * @param session - The session to clean up
   * @param threadId - The thread ID (for onBrowserClosed callback)
   */
  private async cleanupSession(session: BrowserViewerSession, threadId: string): Promise<void> {
    // Clear state BEFORE async operations to prevent double callback from disconnect handler
    this.clearSessionState(threadId);
    // Clear cached input CDP session
    this.inputCdpSessions.delete(threadId);

    // Detach CDP session
    if (session.cdpSession) {
      try {
        await session.cdpSession.detach();
      } catch {
        // Ignore - session may already be detached
      }
    }

    // Close browser connection
    try {
      await session.browser.close();
    } catch {
      // Ignore - browser may already be closed
    }

    // Close browser server (kills the Chrome process) - only if we own it
    if (session.browserServer) {
      try {
        await session.browserServer.close();
      } catch {
        // Ignore - server may already be closed
      }
    }

    this.onBrowserClosed?.(threadId);
  }

  /**
   * Launch a new browser instance and return the components.
   * Consolidates the launch logic shared by createSession and createSharedSession.
   *
   * @param threadId - Thread ID for logging and disconnect handler
   */
  private async launchBrowser(threadId: string): Promise<{
    browserServer: BrowserServer;
    browser: Browser;
    context: BrowserContext;
    cdpSession: CDPSession | null;
    cdpUrl: string | null;
  }> {
    const cdpPort = this.browserConfig.cdpPort ?? 0;

    this.logger?.debug?.(`Launching Chrome for thread ${threadId} with remote-debugging-port=${cdpPort}`);

    const launchOptions: Parameters<typeof chromium.launchServer>[0] = {
      headless: this.browserConfig.headless,
      args: [`--remote-debugging-port=${cdpPort}`, '--no-first-run', '--no-default-browser-check'],
    };

    if (this.browserConfig.executablePath) {
      launchOptions.executablePath = this.browserConfig.executablePath;
    }

    // Track partially initialized resources for cleanup on failure
    let browserServer: BrowserServer | null = null;
    let browser: Browser | null = null;

    try {
      // Launch server - this starts Chrome
      browserServer = await chromium.launchServer(launchOptions);

      // Discover the actual CDP WebSocket URL from Chrome's DevToolsActivePort file
      const cdpUrl = this.discoverCdpUrl(browserServer);

      // Connect to the browser via Playwright for screencast/session management
      browser = await chromium.connect(browserServer.wsEndpoint());

      // Create context and initial page
      const context = await browser.newContext({
        viewport: this.browserConfig.viewport ?? { width: 1280, height: 720 },
      });

      await context.newPage();

      // Set up CDP session for active page (used for screencast/input injection)
      const pages = context.pages();
      const cdpSession = pages[0] ? await context.newCDPSession(pages[0]) : null;

      // Set up disconnection handlers - multiple events can indicate browser closure:
      // - browserServer.on('close'): fires when Chrome process exits
      // - browser.on('disconnected'): fires when Playwright connection is lost
      // - CDP Target.targetDestroyed: fires when any target (page/context) is destroyed
      let disconnectHandled = false;
      const handleDisconnect = () => {
        if (disconnectHandled) return;
        disconnectHandled = true;
        this.handleBrowserDisconnected(threadId);
      };

      // Listen for browser server close (fires when Chrome process exits)
      browserServer.on('close', handleDisconnect);
      // Listen for browser connection lost
      browser.on('disconnected', handleDisconnect);

      // Use browser-level CDP session to watch for ALL target destruction
      // Page-level CDP session only sees events for that specific page, but CLI creates its own pages
      // Browser-level session sees all targets across all contexts
      try {
        const browserCdpSession = await browser.newBrowserCDPSession();
        // Enable target discovery to get notified of all targets
        await browserCdpSession.send('Target.setDiscoverTargets', { discover: true });

        browserCdpSession.on('Target.targetDestroyed', async () => {
          // When a target is destroyed, check if any page targets remain
          // browser.isConnected() stays true because browserServer keeps Chrome alive,
          // so we need to check for actual page targets instead
          try {
            const { targetInfos } = (await browserCdpSession.send('Target.getTargets')) as {
              targetInfos: Array<{ type: string; url: string }>;
            };
            // Filter to actual page targets (not background pages, service workers, etc.)
            const pageTargets = targetInfos.filter(
              t => t.type === 'page' && !t.url.startsWith('chrome://') && !t.url.startsWith('devtools://'),
            );
            if (pageTargets.length === 0) {
              handleDisconnect();
            }
          } catch {
            // CDP session dead, browser definitely closed
            handleDisconnect();
          }
        });

        // Also listen for detached event (fires when CDP connection is lost)
        browserCdpSession.on('Inspector.detached', handleDisconnect);
      } catch {
        // Non-fatal: target watching is a reliability enhancement, not required
        this.logger?.debug?.('Failed to set up browser-level CDP target watching');
      }

      return { browserServer, browser, context, cdpSession, cdpUrl };
    } catch (error) {
      // Clean up partially initialized resources
      this.logger?.warn?.(`Failed to launch browser for thread ${threadId}: ${error}`);
      await browser?.close().catch(() => {});
      await browserServer?.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Get CDP URL for a specific thread.
   */
  getCdpUrlForThread(threadId?: string): string | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    return this.getViewerSession(effectiveThreadId)?.cdpUrl ?? null;
  }

  /**
   * Get the active page for a thread.
   */
  async getActivePageForThread(threadId?: string): Promise<Page | null> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.getViewerSession(effectiveThreadId);

    if (!session?.context) {
      return null;
    }

    return this.resolveActivePage(session.context);
  }

  /**
   * Resolve the active page from a browser context.
   * Uses last page (most recently opened) with fallback to first page.
   */
  private resolveActivePage(context: BrowserContext): Page | null {
    const pages = context.pages();
    return pages[pages.length - 1] ?? pages[0] ?? null;
  }

  /**
   * Get or create a CDP session for the active page in a thread.
   *
   * CDP sessions are page-scoped, so we create a fresh one for the currently active page
   * rather than caching one that may point to a closed or inactive page.
   */
  async getCdpSessionForThread(threadId?: string): Promise<CDPSession | null> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.getViewerSession(effectiveThreadId);

    if (!session?.context) {
      return null;
    }

    // Check if browser is still connected - if not, trigger cleanup
    if (session.browser && !session.browser.isConnected()) {
      this.handleBrowserDisconnected(effectiveThreadId);
      return null;
    }

    const activePage = this.resolveActivePage(session.context);

    if (!activePage) {
      return null;
    }

    // Check if we have a cached CDP session for the current active page
    const cached = this.inputCdpSessions.get(effectiveThreadId);
    const currentUrl = activePage.url();
    if (cached && cached.pageUrl === currentUrl) {
      // Reuse cached session if same page
      return cached.session;
    }

    // Create a new CDP session for the active page
    try {
      const cdpSession = await session.context.newCDPSession(activePage);
      // Cache it for future input events
      this.inputCdpSessions.set(effectiveThreadId, { session: cdpSession, pageUrl: currentUrl });
      return cdpSession;
    } catch {
      // Page may have been closed between getting pages and creating session
      // This often indicates browser was closed - trigger cleanup
      this.inputCdpSessions.delete(effectiveThreadId);
      this.handleBrowserDisconnected(effectiveThreadId);
      return null;
    }
  }

  /**
   * Get the browser context for a thread.
   */
  getContextForThread(threadId?: string): BrowserContext | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    return this.getViewerSession(effectiveThreadId)?.context ?? null;
  }

  /**
   * Create a fresh CDP session for the active page (not cached).
   * Used by screencast which needs fresh sessions on tab switches.
   */
  async createFreshCdpSession(threadId?: string): Promise<CDPSession | null> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.getViewerSession(effectiveThreadId);

    if (!session?.context) {
      return null;
    }

    const activePage = this.resolveActivePage(session.context);
    if (!activePage) {
      return null;
    }

    try {
      return await session.context.newCDPSession(activePage);
    } catch {
      return null;
    }
  }

  /**
   * Create a new session for a thread.
   */
  protected async createSession(threadId: string): Promise<BrowserViewerSession> {
    const savedState = this.getSavedBrowserState(threadId);
    const { browserServer, browser, context, cdpSession, cdpUrl } = await this.launchBrowser(threadId);

    const session: BrowserViewerSession = {
      threadId,
      createdAt: Date.now(),
      browserState: savedState,
      browserServer,
      browser,
      context,
      cdpSession,
      cdpUrl,
    };

    // Store session using consolidated helper
    this.storeSession(session, threadId);

    this.logger?.debug?.(`Chrome launched for thread ${threadId}, CDP URL: ${cdpUrl}`);

    // Notify callback
    this.onBrowserCreated?.(browser, threadId, cdpUrl);

    return session;
  }

  /**
   * Discover the actual CDP WebSocket URL from Chrome's DevToolsActivePort file.
   *
   * Playwright's BrowserServer exposes _userDataDirForTest which points to Chrome's
   * user data directory. Chrome writes a DevToolsActivePort file there containing:
   *   Line 1: The debugging port number
   *   Line 2: The browser WebSocket path (e.g., /devtools/browser/<guid>)
   *
   * This gives us the real CDP URL that external tools like agent-browser can connect to.
   * Returns null if discovery fails - callers should handle this case.
   */
  private discoverCdpUrl(browserServer: BrowserServer): string | null {
    // Access Playwright's internal user data directory
    const userDataDir = (browserServer as BrowserServer & { _userDataDirForTest?: string })._userDataDirForTest;

    if (!userDataDir) {
      this.logger?.warn?.('Could not access browser user data directory');
      return null;
    }

    const portFilePath = join(userDataDir, 'DevToolsActivePort');

    // Chrome may still be writing the file during startup - retry with a short deadline
    const deadline = Date.now() + 1500;
    while (!existsSync(portFilePath) && Date.now() < deadline) {
      // Use Atomics.wait for a non-blocking ~50ms sleep
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }

    if (!existsSync(portFilePath)) {
      this.logger?.warn?.('DevToolsActivePort file not found');
      return null;
    }

    try {
      const content = readFileSync(portFilePath, 'utf-8').trim().split('\n');
      const port = content[0];
      const browserPath = content[1];

      if (!port || !browserPath) {
        this.logger?.warn?.('Invalid DevToolsActivePort content');
        return null;
      }

      const cdpUrl = `ws://127.0.0.1:${port}${browserPath}`;
      this.logger?.debug?.(`Discovered CDP URL from DevToolsActivePort: ${cdpUrl}`);
      return cdpUrl;
    } catch (error) {
      this.logger?.warn?.('Failed to read DevToolsActivePort file:', error);
      return null;
    }
  }

  /**
   * Create a shared session by connecting to an existing browser via CDP URL.
   * Used when BrowserViewer is configured with a cdpUrl to connect to an external browser.
   */
  async createSharedSessionFromCdp(cdpUrl: string): Promise<void> {
    if (this.sharedSession) {
      return; // Already created
    }
    await this.connectToCdp(cdpUrl, DEFAULT_THREAD_ID);
  }

  /**
   * Create a shared session (for 'shared' scope).
   */
  async createSharedSession(): Promise<void> {
    if (this.sharedSession) {
      return; // Already created
    }

    const { browserServer, browser, context, cdpSession, cdpUrl } = await this.launchBrowser(DEFAULT_THREAD_ID);

    const session: BrowserViewerSession = {
      threadId: DEFAULT_THREAD_ID,
      createdAt: Date.now(),
      browserServer,
      browser,
      context,
      cdpSession,
      cdpUrl,
    };

    // Store session using consolidated helper
    this.storeSession(session, DEFAULT_THREAD_ID);

    this.logger?.debug?.(`Shared Chrome launched, CDP URL: ${cdpUrl}`);

    // Notify callbacks
    this.onBrowserCreated?.(browser, DEFAULT_THREAD_ID, cdpUrl);
    this.onSessionCreated?.(session);
  }

  /**
   * Handle browser disconnection for a thread.
   */
  private handleBrowserDisconnected(threadId: string): void {
    this.logger?.debug?.(`Browser disconnected for thread ${threadId}`);

    // Guard against already-closed session (browser.close() triggers 'disconnected')
    if (!this.getViewerSession(threadId)) return;

    // Use consolidated helper for state cleanup
    this.clearSessionState(threadId);
    this.onBrowserClosed?.(threadId);
  }

  /**
   * Connect to an external browser via CDP URL for screencast.
   *
   * This is used when an agent is using their own external CDP (e.g., browser-use cloud).
   * We connect Playwright to the external browser to enable screencast without launching
   * our own browser.
   *
   * @param cdpUrl - The external CDP WebSocket URL (wss://... or ws://...)
   * @param threadId - Thread ID to associate the session with
   */
  async connectToExternalCdp(cdpUrl: string, threadId: string): Promise<BrowserViewerSession> {
    // Close any existing session for this thread to avoid leaking browser processes
    if (this.getViewerSession(threadId)) {
      if (this.usesSharedSlot(threadId)) {
        await this.closeSharedBrowser();
      } else {
        await this.closeThreadBrowser(threadId);
      }
    }

    return this.connectToCdp(cdpUrl, threadId);
  }

  /**
   * Connect to a browser via CDP URL and create a session.
   * Shared implementation for createSharedSessionFromCdp and connectToExternalCdp.
   */
  private async connectToCdp(cdpUrl: string, threadId: string): Promise<BrowserViewerSession> {
    const effectiveThreadId = this.usesSharedSlot(threadId) ? DEFAULT_THREAD_ID : threadId;
    this.logger?.debug?.(`Connecting to CDP for thread ${effectiveThreadId}: ${cdpUrl}`);

    let browser: Browser | null = null;

    try {
      browser = await chromium.connectOverCDP(cdpUrl);

      // Get or create context
      const contexts = browser.contexts();
      const context = contexts[0] ?? (await browser.newContext());

      // Get or create page
      let pages = context.pages();
      if (pages.length === 0) {
        // Wait briefly for external browser to create a page, or create one
        await new Promise(resolve => setTimeout(resolve, 500));
        pages = context.pages();
        if (pages.length === 0) {
          await context.newPage();
          pages = context.pages();
        }
      }

      // Set up CDP session for active page
      const cdpSession = pages[0] ? await context.newCDPSession(pages[0]) : null;

      // Set up disconnection handlers - use effectiveThreadId for consistent lifecycle callbacks
      let disconnectHandled = false;
      const handleDisconnect = () => {
        if (disconnectHandled) return;
        disconnectHandled = true;
        this.handleBrowserDisconnected(effectiveThreadId);
      };

      // Listen for context close (fires when browser window is closed manually)
      context.on('close', handleDisconnect);
      // Listen for browser connection lost
      browser.on('disconnected', handleDisconnect);

      const session: BrowserViewerSession = {
        threadId: effectiveThreadId,
        createdAt: Date.now(),
        browserServer: null, // We don't own the server for external CDP connections
        browser,
        context,
        cdpSession,
        cdpUrl,
      };

      this.storeSession(session, threadId);
      this.logger?.debug?.(`Connected to CDP for thread ${effectiveThreadId}`);

      // Notify callbacks
      this.onBrowserCreated?.(browser, effectiveThreadId, cdpUrl);
      this.onSessionCreated?.(session);

      return session;
    } catch (error) {
      this.logger?.warn?.(`Failed to connect to CDP: ${error}`);
      await browser?.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Close a specific thread's browser.
   */
  async closeThreadBrowser(threadId: string): Promise<void> {
    const session = this.threadSessions.get(threadId);
    if (!session) {
      return;
    }
    await this.cleanupSession(session, threadId);
  }

  /**
   * Close the shared browser.
   */
  async closeSharedBrowser(): Promise<void> {
    if (!this.sharedSession) {
      return;
    }
    await this.cleanupSession(this.sharedSession, DEFAULT_THREAD_ID);
  }

  /**
   * Close all browsers.
   */
  async closeAll(): Promise<void> {
    // Close all thread browsers
    const threadIds = Array.from(this.threadSessions.keys());
    await Promise.all(threadIds.map(id => this.closeThreadBrowser(id)));

    // Close shared browser
    await this.closeSharedBrowser();
  }

  /**
   * Get the manager for a session.
   * Required by base class.
   */
  protected getManagerForSession(session: ThreadSession): Browser {
    const viewerSession = session as BrowserViewerSession;
    return viewerSession.browser;
  }

  /**
   * Get the shared manager.
   * Required by base class.
   */
  protected getSharedManager(): Browser {
    if (!this.sharedSession) {
      throw new Error('Shared browser not launched. Call createSharedSession() first.');
    }
    return this.sharedSession.browser;
  }

  /**
   * Destroy a session and clean up resources.
   * Required by base class.
   */
  protected async doDestroySession(session: ThreadSession): Promise<void> {
    const viewerSession = this.getViewerSession(session.threadId);
    if (!viewerSession) {
      return;
    }
    await this.cleanupSession(viewerSession, session.threadId);
  }

  /**
   * Check if browser is running for a thread.
   */
  isBrowserRunning(threadId?: string): boolean {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    return this.getViewerSession(effectiveThreadId) !== null;
  }
}
