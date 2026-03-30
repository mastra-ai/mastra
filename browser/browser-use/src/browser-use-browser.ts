/**
 * BrowserUseBrowser - Browser automation using Browser Use cloud service
 *
 * Uses the official browser-use-sdk to create cloud browser sessions,
 * then connects via raw CDP for screencast, input injection, and navigation.
 *
 * Similar to BrowserViewer but uses SDK for session management instead of CLI.
 */

import { EventEmitter } from 'node:events';
import { MastraBrowser, ScreencastStreamImpl, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type {
  ScreencastOptions,
  ScreencastStream,
  CdpSessionLike,
  CdpSessionProvider,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';

import WebSocket from 'ws';

import { BrowserUseThreadManager } from './thread-manager';
import { createBrowserUseTools } from './tools';
import type { BrowserConfig, BrowserSessionInfo } from './types';

// ---------------------------------------------------------------------------
// CDP Client (WebSocket-based, copied from BrowserViewer)
// ---------------------------------------------------------------------------

/**
 * A minimal CDP client that wraps a WebSocket connection.
 * Implements CdpSessionLike for compatibility with ScreencastStream.
 */
class CdpClient extends EventEmitter implements CdpSessionLike {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this._isConnected = true;
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());

            // Handle response to a command
            if (message.id !== undefined) {
              const pending = this.pendingMessages.get(message.id);
              if (pending) {
                this.pendingMessages.delete(message.id);
                if (message.error) {
                  pending.reject(new Error(message.error.message || 'CDP error'));
                } else {
                  pending.resolve(message.result);
                }
              }
            }

            // Handle CDP events
            if (message.method) {
              this.emit(message.method, message.params);
            }
          } catch {
            // Ignore malformed messages
          }
        });

        this.ws.on('close', () => {
          this._isConnected = false;
          // Reject all pending messages
          for (const [, pending] of this.pendingMessages) {
            pending.reject(new Error('Connection closed'));
          }
          this.pendingMessages.clear();
          this.emit('close');
        });

        this.ws.on('error', (error: Error) => {
          if (!this._isConnected) {
            reject(error);
          }
          this.emit('error', error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || !this._isConnected) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });

      const message = JSON.stringify({ id, method, params });
      this.ws!.send(message, (error?: Error) => {
        if (error) {
          this.pendingMessages.delete(id);
          reject(error);
        }
      });
    });
  }

  async detach(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  // Override off to satisfy CdpSessionLike
  override off(event: string, handler: (...args: unknown[]) => void): this {
    this.removeListener(event, handler);
    return this;
  }
}

// ---------------------------------------------------------------------------
// BrowserUseBrowser
// ---------------------------------------------------------------------------

/**
 * Browser automation using Browser Use cloud service.
 *
 * Features:
 * - Cloud browser sessions via browser-use-sdk
 * - Raw CDP for screencast, input injection, navigation
 * - Thread isolation modes: 'none' (shared) or 'browser' (isolated per thread)
 */
export class BrowserUseBrowser extends MastraBrowser implements CdpSessionProvider {
  override readonly id: string;
  override readonly name = 'BrowserUseBrowser';
  override readonly provider = 'browser-use';

  /** Current cloud session info */
  private sessionInfo: BrowserSessionInfo | null = null;

  /** CDP client for the current session */
  private cdpClient: CdpClient | null = null;

  /** Active screencast stream */
  private _screencastStream: ScreencastStreamImpl | null = null;

  /** Reconnect timer */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Tab change debounce timer */
  private tabChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** CDP host for fetching targets */
  private cdpHost: string | null = null;

  /** Thread manager - narrowed type from base class */
  declare protected threadManager: BrowserUseThreadManager;

  /** Browser config */
  private browserConfig: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    super(config);
    this.id = `browser-use-${Date.now()}`;
    this.browserConfig = config;

    // Initialize thread manager
    this.threadManager = new BrowserUseThreadManager({
      isolation: config.threadIsolation ?? 'browser',
      browserConfig: config,
      onSessionCreated: (sessionInfo, threadId) => {
        this.logger.debug?.(`Cloud session created for thread ${threadId}: ${sessionInfo.id}`);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // MastraBrowser Abstract Implementation
  // ---------------------------------------------------------------------------

  /**
   * Launch the browser by creating a cloud session and connecting via CDP.
   */
  protected override async doLaunch(): Promise<void> {
    const isolation = this.getThreadIsolationMode();

    if (isolation === 'browser') {
      // For 'browser' isolation, sessions are created on-demand per thread
      // We don't create a shared session here
      this.logger.debug?.('Browser isolation mode: sessions created per thread');
      return;
    }

    // For 'none' isolation, create a shared cloud session
    const sessionInfo = await this.threadManager.createCloudSession();
    this.sessionInfo = sessionInfo;
    this.threadManager.setSharedSession(sessionInfo);

    if (!sessionInfo.cdpUrl) {
      throw new Error('Cloud session created but no CDP URL available');
    }

    // Connect to the browser via CDP
    await this.connectToCdp(sessionInfo.cdpUrl);
  }

  /**
   * Ensure browser is ready and thread session exists.
   * For 'browser' isolation, creates the cloud session and connects CDP before super.ensureReady().
   */
  override async ensureReady(): Promise<void> {
    const isolation = this.getThreadIsolationMode();
    const threadId = this.getCurrentThread() ?? DEFAULT_THREAD_ID;

    // For 'browser' isolation, create session and connect CDP on-demand
    if (isolation === 'browser') {
      const existingSession = this.threadManager.getExistingSessionForThread(threadId);

      if (!existingSession) {
        // Create a new cloud session for this thread
        const sessionInfo = await this.threadManager.getManagerForThread(threadId);
        this.sessionInfo = sessionInfo;

        if (!sessionInfo?.cdpUrl) {
          throw new Error(`Cloud session created but no CDP URL available for thread: ${threadId}`);
        }

        // Connect to CDP if not already connected
        if (!this.cdpClient?.isConnected) {
          await this.connectToCdp(sessionInfo.cdpUrl);
        }
      } else if (!this.cdpClient?.isConnected && existingSession.cdpUrl) {
        // Session exists but CDP not connected - reconnect
        await this.connectToCdp(existingSession.cdpUrl);
      }
    }

    await super.ensureReady();
  }

  /**
   * Close the browser by stopping cloud sessions and disconnecting CDP.
   */
  protected override async doClose(): Promise<void> {
    // Stop screencast
    if (this._screencastStream) {
      await this._screencastStream.stop();
      this._screencastStream = null;
    }

    // Disconnect CDP
    if (this.cdpClient) {
      await this.cdpClient.detach();
      this.cdpClient = null;
    }

    // Clear reconnect timer
    this.clearReconnectTimer();

    // Destroy all cloud sessions
    await this.threadManager.destroyAll();
    this.sessionInfo = null;
  }

  /**
   * Check if the browser is alive.
   */
  override async checkBrowserAlive(): Promise<boolean> {
    const isolation = this.getThreadIsolationMode();

    if (isolation === 'browser') {
      // Check if any thread sessions exist
      return this.threadManager.hasActiveThreadSessions();
    }

    // For 'none' isolation, check CDP connection
    return this.cdpClient?.isConnected ?? false;
  }

  // ---------------------------------------------------------------------------
  // CDP Connection
  // ---------------------------------------------------------------------------

  /**
   * Connect to a browser via CDP WebSocket URL.
   */
  private async connectToCdp(cdpUrl: string): Promise<void> {
    // Store the host for later target discovery
    const hostMatch = cdpUrl.match(/^https?:\/\/([^/]+)/);
    this.cdpHost = hostMatch?.[1] ?? null;

    // Get page-level CDP URL (not browser-level)
    const pageCdpUrl = await this.getPageCdpUrl(cdpUrl);

    this.cdpClient = new CdpClient();
    await this.cdpClient.connect(pageCdpUrl);

    // Handle disconnection
    this.cdpClient.on('close', () => {
      this.handleDisconnect();
    });

    // Set up tab change detection via CDP Target events
    this.setupTabChangeDetection();

    // Fetch initial URL
    await this.getCurrentUrl();

    this.notifyBrowserReady();
  }

  /**
   * Set up listeners for tab creation/destruction to reconnect screencast,
   * and navigation events for URL updates.
   */
  private setupTabChangeDetection(): void {
    if (!this.cdpClient) return;

    // Listen for target events (new tabs, closed tabs)
    const onTargetCreated = () => {
      this.scheduleScreencastReconnect('new tab created');
    };

    const onTargetDestroyed = () => {
      this.scheduleScreencastReconnect('tab closed');
    };

    // Listen for navigation events (URL changes)
    const onFrameNavigated = (params: { frame: { url: string; parentId?: string } }) => {

      // Only emit URL for main frame navigations (no parentId)
      if (!params.frame.parentId && params.frame.url) {
        this.lastUrl = params.frame.url;
        // Emit URL update to screencast stream
        if (this._screencastStream?.isActive()) {
          this._screencastStream.emitUrl(params.frame.url);
        }
      }
    };

    // CDP events for target management
    this.cdpClient.on('Target.targetCreated', onTargetCreated);
    this.cdpClient.on('Target.targetDestroyed', onTargetDestroyed);
    this.cdpClient.on('Page.frameNavigated', onFrameNavigated);

    // Enable target discovery to receive these events
    this.cdpClient.send('Target.setDiscoverTargets', { discover: true }).catch(() => {
      // Some CDP endpoints may not support this - that's okay
    });

    // Enable Page domain to receive frameNavigated events
    this.cdpClient.send('Page.enable', {}).catch(() => {
      // May already be enabled or not supported
    });
  }

  /**
   * Schedule a screencast reconnect with debouncing.
   */
  private scheduleScreencastReconnect(reason: string): void {
    if (this.tabChangeDebounceTimer) {
      clearTimeout(this.tabChangeDebounceTimer);
    }

    this.tabChangeDebounceTimer = setTimeout(() => {
      this.tabChangeDebounceTimer = null;
      void this.reconnectScreencastToActiveTab(reason);
    }, 300);
  }

  /**
   * Reconnect screencast to the currently active tab.
   */
  private async reconnectScreencastToActiveTab(reason: string): Promise<void> {
    const stream = this._screencastStream;
    if (!stream || !stream.isActive()) {
      return;
    }

    if (!this.isBrowserRunning()) {
      return;
    }

    this.logger.debug?.(`Reconnecting screencast: ${reason}`);

    try {
      // Reconnect to get fresh CDP session for active page
      if (this.sessionInfo?.cdpUrl) {
        const newPageUrl = await this.getPageCdpUrl(this.sessionInfo.cdpUrl);

        // Disconnect old client and create new one for active page
        await this.cdpClient?.detach();
        this.cdpClient = new CdpClient();
        await this.cdpClient.connect(newPageUrl);

        // Re-setup tab detection on new client
        this.setupTabChangeDetection();

        // Handle disconnection
        this.cdpClient.on('close', () => {
          this.handleDisconnect();
        });
      }

      // Small delay to let state settle
      await new Promise(resolve => setTimeout(resolve, 150));
      await stream.reconnect();
    } catch {
      this.logger.debug?.('Screencast reconnect failed');
    }
  }

  /**
   * Convert a browser-level CDP URL to a page-level CDP URL.
   * Browser Use returns https:// URLs that need to be converted to wss://
   * and we need to discover the actual page target via /json endpoint.
   */
  private async getPageCdpUrl(browserCdpUrl: string): Promise<string> {
    // Convert http(s):// to ws(s)://
    let wsUrl = browserCdpUrl;
    if (browserCdpUrl.startsWith('https://')) {
      wsUrl = browserCdpUrl.replace('https://', 'wss://');
    } else if (browserCdpUrl.startsWith('http://')) {
      wsUrl = browserCdpUrl.replace('http://', 'ws://');
    }

    // Extract host from the URL to query /json endpoint
    const match = wsUrl.match(/^wss?:\/\/([^/]+)/);
    if (!match) {
      return wsUrl;
    }

    const hostPort = match[1];
    const jsonUrl = `https://${hostPort}/json`;

    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        return wsUrl;
      }

      const targets = (await response.json()) as Array<{
        type: string;
        url: string;
        webSocketDebuggerUrl?: string;
      }>;

      // Find a page target (prefer non-chrome:// pages)
      const pageTargets = targets.filter(t => t.type === 'page');
      const regularPage = pageTargets.find(t => !t.url.startsWith('chrome://'));
      const target = regularPage || pageTargets[0];

      if (target?.webSocketDebuggerUrl) {
        return target.webSocketDebuggerUrl;
      }

      return browserCdpUrl;
    } catch {
      return browserCdpUrl;
    }
  }

  private handleDisconnect(): void {
    this.cdpClient = null;
    this.notifyBrowserClosed();

    if (this.config.autoReconnect && this.sessionInfo?.cdpUrl) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.sessionInfo?.cdpUrl) {
        this.connectToCdp(this.sessionInfo.cdpUrl).catch(error => {
          this.logger.error?.('Failed to reconnect to browser', error);
          this.scheduleReconnect();
        });
      }
    }, this.config.reconnectDelay ?? 1000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // CdpSessionProvider Implementation
  // ---------------------------------------------------------------------------

  async getCdpSession(): Promise<CdpSessionLike> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }
    return this.cdpClient;
  }

  isBrowserRunning(): boolean {
    return this.cdpClient?.isConnected ?? false;
  }

  // ---------------------------------------------------------------------------
  // Thread-aware Methods
  // ---------------------------------------------------------------------------

  /**
   * Get CDP client for a specific thread.
   */
  private async getCdpClientForThread(threadId?: string): Promise<CdpClient> {
    const isolation = this.getThreadIsolationMode();
    const effectiveThreadId = threadId ?? this.getCurrentThread() ?? DEFAULT_THREAD_ID;

    if (isolation === 'none' || effectiveThreadId === DEFAULT_THREAD_ID) {
      if (!this.cdpClient?.isConnected) {
        throw new Error('Not connected to browser');
      }
      return this.cdpClient;
    }

    // For 'browser' isolation, get or create session for thread
    const sessionInfo = this.threadManager.getExistingSessionForThread(effectiveThreadId);

    if (!sessionInfo) {
      // Create session if needed
      await this.threadManager.getManagerForThread(effectiveThreadId);
      const newSessionInfo = this.threadManager.getExistingSessionForThread(effectiveThreadId);
      if (!newSessionInfo?.cdpUrl) {
        throw new Error(`No CDP URL for thread: ${effectiveThreadId}`);
      }
      // Connect to CDP for this session
      if (!this.cdpClient?.isConnected) {
        await this.connectToCdp(newSessionInfo.cdpUrl);
      }
    } else if (!this.cdpClient?.isConnected && sessionInfo.cdpUrl) {
      // Session exists but CDP not connected - connect now
      await this.connectToCdp(sessionInfo.cdpUrl);
    }

    // Use the shared client
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }
    return this.cdpClient;
  }

  // ---------------------------------------------------------------------------
  // URL and Navigation
  // ---------------------------------------------------------------------------

  /**
   * Get the current URL of the browser page.
   */
  override async getCurrentUrl(threadId?: string): Promise<string | null> {
    try {
      const client = await this.getCdpClientForThread(threadId);

      const result = (await client.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
      })) as { result?: { value?: string } };

      const url = result?.result?.value;
      if (url) {
        this.lastUrl = url;
        const effectiveThreadId = threadId ?? this.getCurrentThread() ?? DEFAULT_THREAD_ID;
        this.threadManager.updateLastUrl(effectiveThreadId, url);
      }
      return url ?? null;
    } catch {
      return this.lastUrl ?? null;
    }
  }

  /**
   * Get the current page title.
   */
  async getTitle(): Promise<string | null> {
    if (!this.cdpClient?.isConnected) {
      return null;
    }

    try {
      const result = (await this.cdpClient.send('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true,
      })) as { result?: { value?: string } };

      return result?.result?.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Navigate to a URL.
   */
  override async navigateTo(url: string, threadId?: string): Promise<void> {
    const client = await this.getCdpClientForThread(threadId);
    await client.send('Page.navigate', { url });
    this.lastUrl = url;
  }

  // ---------------------------------------------------------------------------
  // Screencast
  // ---------------------------------------------------------------------------

  /**
   * Start screencast streaming.
   */
  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }

    if (this._screencastStream) {
      await this._screencastStream.stop();
    }

    const stream = new ScreencastStreamImpl(this, options ?? this.config.screencast);
    this._screencastStream = stream;

    // URL updates are handled by Page.frameNavigated listener in setupTabChangeDetection()

    await stream.start();
    await this.getCurrentUrl();

    return stream;
  }

  // ---------------------------------------------------------------------------
  // Input Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject a mouse event into the browser.
   */
  override async injectMouseEvent(params: MouseEventParams, threadId?: string): Promise<void> {
    const client = await this.getCdpClientForThread(threadId);
    await client.send('Input.dispatchMouseEvent', params as unknown as Record<string, unknown>);
  }

  /**
   * Inject a keyboard event into the browser.
   */
  override async injectKeyboardEvent(params: KeyboardEventParams, threadId?: string): Promise<void> {
    const client = await this.getCdpClientForThread(threadId);
    await client.send('Input.dispatchKeyEvent', params as unknown as Record<string, unknown>);
  }

  // ---------------------------------------------------------------------------
  // Tab Management
  // ---------------------------------------------------------------------------

  /**
   * Manage browser tabs via CDP.
   */
  async tabs(input: { action: 'list' | 'new' | 'switch' | 'close'; index?: number; url?: string }): Promise<{
    tabs?: Array<{ index: number; url: string; title: string; active: boolean }>;
    activeTab?: number;
    success?: boolean;
    hint?: string;
  }> {
    const client = await this.getCdpClientForThread();

    // Get all targets (pages)
    const response = (await client.send('Target.getTargets')) as {
      targetInfos: Array<{
        targetId: string;
        type: string;
        title: string;
        url: string;
        attached: boolean;
      }>;
    };

    const pageTargets = response.targetInfos.filter(t => t.type === 'page');

    switch (input.action) {
      case 'list': {
        const tabs = pageTargets.map((target, index) => ({
          index,
          url: target.url,
          title: target.title,
          active: target.attached,
        }));
        const activeTab = tabs.findIndex(t => t.active);
        return { tabs, activeTab: activeTab >= 0 ? activeTab : 0 };
      }

      case 'new': {
        // Create a new target (tab)
        const createResponse = (await client.send('Target.createTarget', {
          url: input.url || 'about:blank',
        })) as { targetId: string };

        // Reconnect screencast to the new tab
        if (this._screencastStream && this.cdpHost) {
          this.scheduleScreencastReconnect('new tab opened');
        }

        return {
          success: true,
          hint: `Opened new tab${input.url ? ` with URL: ${input.url}` : ''}. Target ID: ${createResponse.targetId}`,
        };
      }

      case 'switch': {
        if (input.index === undefined) {
          return { success: false, hint: 'Index required for switch action' };
        }
        if (input.index < 0 || input.index >= pageTargets.length) {
          return { success: false, hint: `Invalid tab index. Available: 0-${pageTargets.length - 1}` };
        }

        const targetId = pageTargets[input.index]?.targetId;
        if (!targetId) {
          return { success: false, hint: 'Target not found' };
        }

        // Activate the target
        await client.send('Target.activateTarget', { targetId });

        // Reconnect screencast to the new active tab
        if (this._screencastStream && this.cdpHost) {
          this.scheduleScreencastReconnect('tab switched');
        }

        return {
          success: true,
          activeTab: input.index,
          hint: `Switched to tab ${input.index}: ${pageTargets[input.index]?.title || 'Unknown'}`,
        };
      }

      case 'close': {
        if (input.index === undefined) {
          return { success: false, hint: 'Index required for close action' };
        }
        if (input.index < 0 || input.index >= pageTargets.length) {
          return { success: false, hint: `Invalid tab index. Available: 0-${pageTargets.length - 1}` };
        }

        const targetId = pageTargets[input.index]?.targetId;
        if (!targetId) {
          return { success: false, hint: 'Target not found' };
        }

        await client.send('Target.closeTarget', { targetId });

        // Reconnect screencast if needed
        if (this._screencastStream && this.cdpHost) {
          this.scheduleScreencastReconnect('tab closed');
        }

        return {
          success: true,
          hint: `Closed tab ${input.index}`,
        };
      }

      default:
        return { success: false, hint: `Unknown action: ${input.action}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  /**
   * Get the tools provided by this browser.
   */
  getTools() {
    return createBrowserUseTools(this);
  }

  // ---------------------------------------------------------------------------
  // Session Info
  // ---------------------------------------------------------------------------

  /**
   * Get the current cloud session info.
   */
  getSessionInfo(): BrowserSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Get the live view URL for the current session.
   */
  getLiveUrl(): string | null {
    return this.sessionInfo?.liveUrl ?? null;
  }

  /**
   * Get the Browser Use SDK client for running AI tasks.
   */
  getClient() {
    return this.threadManager.getClient();
  }
}
