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
  /** Playwright browser server (owns the Chrome process) */
  browserServer: BrowserServer;
  /** Playwright browser instance (connected to server) */
  browser: Browser;
  /** Browser context */
  context: BrowserContext;
  /** CDP session for the active page */
  cdpSession: CDPSession | null;
  /** CDP WebSocket URL */
  cdpUrl: string;
}

/**
 * Configuration for BrowserViewerThreadManager.
 */
export interface BrowserViewerThreadManagerConfig extends ThreadManagerConfig {
  /** Browser configuration */
  browserConfig: BrowserViewerConfig;
  /** Callback when a browser is created for a thread */
  onBrowserCreated?: (browser: Browser, threadId: string, cdpUrl: string) => void;
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
  private readonly onBrowserCreated?: (browser: Browser, threadId: string, cdpUrl: string) => void;
  private readonly onBrowserClosed?: (threadId: string) => void;

  /** Map of thread ID to session info (for 'thread' scope) */
  private readonly threadSessions = new Map<string, BrowserViewerSession>();

  /** Shared session info (for 'shared' scope) */
  private sharedSession: BrowserViewerSession | null = null;

  constructor(config: BrowserViewerThreadManagerConfig) {
    super(config);
    this.browserConfig = config.browserConfig;
    this.onBrowserCreated = config.onBrowserCreated;
    this.onBrowserClosed = config.onBrowserClosed;
  }

  /**
   * Get CDP URL for a specific thread.
   */
  getCdpUrlForThread(threadId?: string): string | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;

    if (this.scope === 'shared') {
      return this.sharedSession?.cdpUrl ?? null;
    }

    return this.threadSessions.get(effectiveThreadId)?.cdpUrl ?? null;
  }

  /**
   * Get the active page for a thread.
   */
  async getActivePageForThread(threadId?: string): Promise<Page | null> {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.scope === 'shared' ? this.sharedSession : this.threadSessions.get(effectiveThreadId);

    if (!session?.context) {
      return null;
    }

    const pages = session.context.pages();
    return pages[0] ?? null;
  }

  /**
   * Get the CDP session for a thread.
   */
  getCdpSessionForThread(threadId?: string): CDPSession | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.scope === 'shared' ? this.sharedSession : this.threadSessions.get(effectiveThreadId);

    return session?.cdpSession ?? null;
  }

  /**
   * Get the browser context for a thread.
   */
  getContextForThread(threadId?: string): BrowserContext | null {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;
    const session = this.scope === 'shared' ? this.sharedSession : this.threadSessions.get(effectiveThreadId);

    return session?.context ?? null;
  }

  /**
   * Create a new session for a thread.
   */
  protected async createSession(threadId: string): Promise<BrowserViewerSession> {
    const savedState = this.getSavedBrowserState(threadId);

    // Use a specific CDP port so we can discover it, or let Chrome choose
    const cdpPort = this.browserConfig.cdpPort ?? 0;

    this.logger?.debug?.(`Launching Chrome for thread ${threadId} with remote-debugging-port=${cdpPort}`);

    const launchOptions: Parameters<typeof chromium.launchServer>[0] = {
      headless: this.browserConfig.headless ?? false,
      args: [`--remote-debugging-port=${cdpPort}`, '--no-first-run', '--no-default-browser-check'],
    };

    if (this.browserConfig.executablePath) {
      launchOptions.executablePath = this.browserConfig.executablePath;
    }

    // Launch server - this starts Chrome
    const browserServer = await chromium.launchServer(launchOptions);

    // Discover the actual CDP WebSocket URL from Chrome's DevToolsActivePort file
    const cdpUrl = this.discoverCdpUrl(browserServer);

    // Connect to the browser via Playwright for screencast/session management
    const browser = await chromium.connect(browserServer.wsEndpoint());

    // Create context and initial page
    const context = await browser.newContext({
      viewport: this.browserConfig.viewport ?? { width: 1280, height: 720 },
    });

    await context.newPage();

    // Set up CDP session for active page
    const pages = context.pages();
    const cdpSession = pages[0] ? await context.newCDPSession(pages[0]) : null;

    // Set up disconnection handler
    browser.on('disconnected', () => {
      this.handleBrowserDisconnected(threadId);
    });

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

    // Store in our session map
    this.threadSessions.set(threadId, session);

    // Store in base class sessions map (for hasSession() checks)
    this.sessions.set(threadId, session);

    // Store browser in thread managers map (used by base class)
    this.threadManagers.set(threadId, browser);

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
   */
  private discoverCdpUrl(browserServer: BrowserServer): string {
    // Access Playwright's internal user data directory
    const userDataDir = (browserServer as BrowserServer & { _userDataDirForTest?: string })._userDataDirForTest;

    if (!userDataDir) {
      this.logger?.warn?.('Could not access browser user data directory, falling back to Playwright wsEndpoint');
      return browserServer.wsEndpoint();
    }

    const portFilePath = join(userDataDir, 'DevToolsActivePort');

    if (!existsSync(portFilePath)) {
      this.logger?.warn?.('DevToolsActivePort file not found, falling back to Playwright wsEndpoint');
      return browserServer.wsEndpoint();
    }

    try {
      const content = readFileSync(portFilePath, 'utf-8').trim().split('\n');
      const port = content[0];
      const browserPath = content[1];

      if (!port || !browserPath) {
        this.logger?.warn?.('Invalid DevToolsActivePort content, falling back to Playwright wsEndpoint');
        return browserServer.wsEndpoint();
      }

      const cdpUrl = `ws://127.0.0.1:${port}${browserPath}`;
      this.logger?.debug?.(`Discovered CDP URL from DevToolsActivePort: ${cdpUrl}`);
      return cdpUrl;
    } catch (error) {
      this.logger?.warn?.('Failed to read DevToolsActivePort file:', error);
      return browserServer.wsEndpoint();
    }
  }

  /**
   * Create a shared session (for 'shared' scope).
   */
  async createSharedSession(): Promise<void> {
    if (this.sharedSession) {
      return; // Already created
    }

    const port = this.browserConfig.cdpPort ?? 0;

    this.logger?.debug?.(`Launching shared Chrome with remote-debugging-port=${port}`);

    const launchOptions: Parameters<typeof chromium.launchServer>[0] = {
      headless: this.browserConfig.headless ?? false,
      args: [`--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check'],
    };

    if (this.browserConfig.executablePath) {
      launchOptions.executablePath = this.browserConfig.executablePath;
    }

    // Launch server - this starts Chrome
    const browserServer = await chromium.launchServer(launchOptions);

    // Discover the actual CDP WebSocket URL from Chrome's DevToolsActivePort file
    const cdpUrl = this.discoverCdpUrl(browserServer);

    // Connect to the browser via Playwright for screencast/session management
    const browser = await chromium.connect(browserServer.wsEndpoint());

    // Create context and initial page
    const context = await browser.newContext({
      viewport: this.browserConfig.viewport ?? { width: 1280, height: 720 },
    });

    await context.newPage();

    // Set up CDP session for active page
    const pages = context.pages();
    const cdpSession = pages[0] ? await context.newCDPSession(pages[0]) : null;

    // Set up disconnection handler
    browser.on('disconnected', () => {
      this.handleBrowserDisconnected(DEFAULT_THREAD_ID);
    });

    this.sharedSession = {
      threadId: DEFAULT_THREAD_ID,
      createdAt: Date.now(),
      browserServer,
      browser,
      context,
      cdpSession,
      cdpUrl,
    };

    // Store in base class sessions map (for hasSession() checks)
    this.sessions.set(DEFAULT_THREAD_ID, this.sharedSession);

    // Set shared manager (used by base class)
    this.setSharedManager(browser);

    this.logger?.debug?.(`Shared Chrome launched, CDP URL: ${cdpUrl}`);

    // Notify callback
    this.onBrowserCreated?.(browser, DEFAULT_THREAD_ID, cdpUrl);
  }

  /**
   * Handle browser disconnection for a thread.
   */
  private handleBrowserDisconnected(threadId: string): void {
    this.logger?.debug?.(`Browser disconnected for thread ${threadId}`);

    if (this.scope === 'shared') {
      this.sharedSession = null;
      this.clearSharedManager();
      this.sessions.delete(DEFAULT_THREAD_ID);
    } else {
      this.threadSessions.delete(threadId);
      this.threadManagers.delete(threadId);
      this.sessions.delete(threadId);
    }

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
    this.logger?.debug?.(`Connecting to external CDP for thread ${threadId}: ${cdpUrl}`);

    try {
      // Connect to external browser via CDP
      const browser = await chromium.connectOverCDP(cdpUrl);

      // Get the default context (external browsers typically have one)
      const contexts = browser.contexts();
      const context = contexts[0] ?? (await browser.newContext());

      // Get the active page
      const pages = context.pages();
      let page = pages[0];

      // If no pages, wait a moment for the external browser to create one
      if (!page) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedPages = context.pages();
        page = updatedPages[0];
      }

      // Set up CDP session for the active page
      const cdpSession = page ? await context.newCDPSession(page) : null;

      // Set up disconnection handler
      browser.on('disconnected', () => {
        this.handleBrowserDisconnected(threadId);
      });

      // Create session without browserServer (we don't own the browser process)
      const session: BrowserViewerSession = {
        threadId,
        createdAt: Date.now(),
        browserServer: null as unknown as BrowserServer, // We don't own the server
        browser,
        context,
        cdpSession,
        cdpUrl,
      };

      // Store in session maps
      this.threadSessions.set(threadId, session);
      this.sessions.set(threadId, session);
      this.threadManagers.set(threadId, browser);

      this.logger?.debug?.(`Connected to external CDP for thread ${threadId}`);

      // Notify callback (triggers screencast start)
      this.onBrowserCreated?.(browser, threadId, cdpUrl);
      this.onSessionCreated?.(session);

      return session;
    } catch (error) {
      this.logger?.warn?.(`Failed to connect to external CDP: ${error}`);
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

    // Detach CDP session
    if (session.cdpSession) {
      try {
        await session.cdpSession.detach();
      } catch {
        // Ignore
      }
    }

    // Close browser connection
    try {
      await session.browser.close();
    } catch {
      // Ignore
    }

    // Close browser server (kills the Chrome process)
    try {
      await session.browserServer.close();
    } catch {
      // Ignore
    }

    this.threadSessions.delete(threadId);
    this.threadManagers.delete(threadId);
    this.sessions.delete(threadId);

    this.onBrowserClosed?.(threadId);
  }

  /**
   * Close the shared browser.
   */
  async closeSharedBrowser(): Promise<void> {
    if (!this.sharedSession) {
      return;
    }

    // Detach CDP session
    if (this.sharedSession.cdpSession) {
      try {
        await this.sharedSession.cdpSession.detach();
      } catch {
        // Ignore
      }
    }

    // Close browser connection
    try {
      await this.sharedSession.browser.close();
    } catch {
      // Ignore
    }

    // Close browser server (kills the Chrome process)
    try {
      await this.sharedSession.browserServer.close();
    } catch {
      // Ignore
    }

    this.sharedSession = null;
    this.clearSharedManager();

    this.onBrowserClosed?.(DEFAULT_THREAD_ID);
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
    const viewerSession = this.threadSessions.get(session.threadId);
    if (!viewerSession) {
      return;
    }

    // Detach CDP session
    if (viewerSession.cdpSession) {
      try {
        await viewerSession.cdpSession.detach();
      } catch {
        // Ignore
      }
    }

    // Close browser connection
    try {
      await viewerSession.browser.close();
    } catch {
      // Ignore
    }

    // Close browser server (kills the Chrome process)
    try {
      await viewerSession.browserServer.close();
    } catch {
      // Ignore
    }

    this.threadSessions.delete(session.threadId);
    this.onBrowserClosed?.(session.threadId);
  }

  /**
   * Check if browser is running for a thread.
   */
  isBrowserRunning(threadId?: string): boolean {
    const effectiveThreadId = threadId ?? DEFAULT_THREAD_ID;

    if (this.scope === 'shared') {
      return this.sharedSession !== null;
    }

    return this.threadSessions.has(effectiveThreadId);
  }
}
