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
    // Get page-level CDP URL (not browser-level)
    const pageCdpUrl = await this.getPageCdpUrl(cdpUrl);

    this.cdpClient = new CdpClient();
    await this.cdpClient.connect(pageCdpUrl);

    // Handle disconnection
    this.cdpClient.on('close', () => {
      this.handleDisconnect();
    });

    // Fetch initial URL
    await this.getCurrentUrl();

    this.notifyBrowserReady();
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

    // Update URL cache on each frame
    stream.on('frame', () => {
      this.getCurrentUrl().catch(() => {});
    });

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
