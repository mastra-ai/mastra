/**
 * MastraBrowser Base Class
 *
 * Abstract base class for browser providers. Extends MastraBase for logger integration.
 *
 * ## Architecture
 *
 * Each browser provider defines its own tools via the `getTools()` method.
 * This allows different providers to offer different capabilities:
 *
 * - **AgentBrowser**: 17 deterministic tools using refs ([ref=e1], [ref=e2])
 * - **StagehandBrowser**: AI-powered tools (act, extract, observe)
 *
 * ## Two Paradigms
 *
 * Browser providers fall into two paradigms:
 *
 * 1. **Deterministic** (Playwright, agent-browser) - Uses refs and selectors
 * 2. **AI-powered** (Stagehand) - Uses natural language instructions
 *
 * Both extend this base class and implement `getTools()` to return their tools.
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';
import { isProcessorWorkflow } from '../processors/index';
import type { InputProcessor, InputProcessorOrWorkflow } from '../processors/index';
import type { Tool } from '../tools/tool';
import { createError } from './errors';
import type { BrowserToolError, ErrorCode } from './errors';
import { BrowserContextProcessor } from './processor';
import type { ScreencastOptions as ScreencastOptionsType } from './screencast/types';
import { DEFAULT_THREAD_ID } from './thread-manager';
import type { BrowserState, BrowserTabState, BrowserScope, ThreadManager } from './thread-manager';

// Re-export screencast types from the screencast module
export type { ScreencastOptions, ScreencastFrameData, ScreencastEvents } from './screencast/types';

// Alias for internal use
type ScreencastOptions = ScreencastOptionsType;

// =============================================================================
// Status & Lifecycle Types
// =============================================================================

/**
 * Browser provider status.
 */
export type BrowserStatus = 'pending' | 'launching' | 'ready' | 'error' | 'closing' | 'closed';

/**
 * Lifecycle hook that fires during browser state transitions.
 */
export type BrowserLifecycleHook = (args: { browser: MastraBrowser }) => void | Promise<void>;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * CDP URL provider - can be a static string or an async function.
 * Useful for cloud providers where the CDP URL may change per session.
 */
export type CdpUrlProvider = string | (() => string | Promise<string>);

/**
 * Base configuration properties shared by all browser providers.
 * This interface contains fields common to all browser configurations.
 *
 * **For extending**: Use this interface when creating provider-specific configs
 * (e.g., `interface MyProviderConfig extends BrowserConfigBase`).
 *
 * **For consuming**: Use {@link BrowserConfig} which adds compile-time validation
 * that `cdpUrl` and `scope: 'thread'` cannot be used together.
 */
export interface BrowserConfigBase {
  /**
   * Whether to run the browser in headless mode (no visible UI).
   * @default true
   */
  headless?: boolean;

  /**
   * Browser viewport dimensions.
   * Controls the size of the browser window and how websites render.
   */
  viewport?: {
    width: number;
    height: number;
  };

  /**
   * Default timeout in milliseconds for browser operations.
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * CDP WebSocket URL or async provider function.
   * When provided, connects to an existing browser instead of launching a new one.
   * Useful for cloud providers (Browserbase, Browserless, Kernel, etc.).
   *
   * **Important:** When using `cdpUrl`, you must use `scope: 'shared'` (or omit `scope`
   * to let it default to 'shared' behavior). Using `cdpUrl` with `scope: 'thread'`
   * will throw an error because thread isolation requires spawning separate browser
   * instances, which isn't possible when connecting to an existing browser via CDP.
   *
   * @example
   * ```ts
   * // Connect to a local Chrome with remote debugging enabled
   * { cdpUrl: 'ws://localhost:9222' }
   *
   * // Connect to Browserless cloud provider
   * { cdpUrl: 'wss://chrome.browserless.io?token=YOUR_TOKEN', scope: 'shared' }
   *
   * // Use an async provider function for dynamic URLs
   * { cdpUrl: async () => await fetchBrowserlessUrl() }
   * ```
   */
  cdpUrl?: CdpUrlProvider;

  /**
   * Browser instance scope across threads.
   *
   * - `'thread'` (default): Each thread gets its own isolated browser instance.
   *   Best for parallel agents that need separate browser states.
   *
   * - `'shared'`: All threads share a single browser instance.
   *   Required when using `cdpUrl` to connect to an existing browser.
   *
   * **Important:** `scope: 'thread'` cannot be used with `cdpUrl` because thread
   * isolation requires spawning new browser instances, which isn't possible when
   * connecting to an existing browser via CDP. This configuration will throw an error.
   *
   * @default 'thread'
   *
   * @example
   * ```ts
   * // Isolated browsers per thread (default)
   * { scope: 'thread' }
   *
   * // Shared browser for all threads
   * { scope: 'shared' }
   *
   * // When using cdpUrl, scope must be 'shared'
   * { cdpUrl: 'ws://localhost:9222', scope: 'shared' }
   * ```
   */
  scope?: BrowserScope;

  /**
   * Called after the browser reaches 'ready' status.
   */
  onLaunch?: BrowserLifecycleHook;

  /**
   * Called before the browser is closed.
   */
  onClose?: BrowserLifecycleHook;

  /**
   * Screencast options for streaming browser frames.
   * Controls image format, quality, and dimensions.
   */
  screencast?: ScreencastOptions;
}

/**
 * Browser configuration with compile-time enforcement of cdpUrl/scope compatibility.
 *
 * This type enforces that `cdpUrl` and `scope: 'thread'` cannot be used together:
 * - When `cdpUrl` is provided, `scope` must be `'shared'` or omitted
 * - When `scope: 'thread'` is used, `cdpUrl` must not be provided
 *
 * @example
 * ```ts
 * // Valid configurations:
 * { headless: true }                              // Local browser, thread scope (default)
 * { scope: 'thread' }                             // Explicit thread isolation
 * { scope: 'shared' }                             // Shared browser
 * { cdpUrl: 'ws://localhost:9222' }               // CDP connection, defaults to shared
 * { cdpUrl: 'ws://localhost:9222', scope: 'shared' }  // CDP with explicit shared
 *
 * // Invalid configuration (TypeScript error):
 * { cdpUrl: 'ws://localhost:9222', scope: 'thread' }  // Error: cannot combine cdpUrl with thread scope
 * ```
 */
export type BrowserConfig =
  | (BrowserConfigBase & { cdpUrl?: undefined; scope?: BrowserScope })
  | (BrowserConfigBase & { cdpUrl: CdpUrlProvider; scope?: 'shared' });

// =============================================================================
// Screencast Types (re-exported from ./screencast/types)
// =============================================================================

/**
 * A screencast stream that emits frames.
 * Uses EventEmitter pattern for frame delivery.
 */
export interface ScreencastStream {
  /** Stop the screencast */
  stop(): Promise<void>;
  /** Check if screencast is active */
  isActive(): boolean;
  /** Reconnect the screencast (e.g., after tab change) */
  reconnect(): Promise<void>;
  /** Register event handlers */
  on(event: 'frame', handler: (frame: { data: string; viewport: { width: number; height: number } }) => void): this;
  on(event: 'stop', handler: (reason: string) => void): this;
  on(event: 'error', handler: (error: Error) => void): this;
  on(event: 'url', handler: (url: string) => void): this;
  /** Emit a URL update (called by browser providers on navigation) */
  emitUrl(url: string): void;
}

// =============================================================================
// Event Injection Types (for Studio live view)
// =============================================================================

/**
 * Mouse event parameters for CDP injection.
 */
export interface MouseEventParams {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'none';
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
  modifiers?: number;
}

/**
 * Keyboard event parameters for CDP injection.
 */
export interface KeyboardEventParams {
  type: 'keyDown' | 'keyUp' | 'char';
  key?: string;
  code?: string;
  text?: string;
  modifiers?: number;
  /** Windows virtual key code (required for non-printable keys like Enter, Tab, Arrow keys) */
  windowsVirtualKeyCode?: number;
}

// =============================================================================
// MastraBrowser Base Class
// =============================================================================

/**
 * Abstract base class for browser providers.
 *
 * Providers extend this class and implement the abstract methods.
 * Each method corresponds to one of the 17 flat tools.
 */
export abstract class MastraBrowser extends MastraBase {
  // ---------------------------------------------------------------------------
  // Abstract Identity (providers must define)
  // ---------------------------------------------------------------------------

  /** Unique instance identifier */
  abstract readonly id: string;

  /** Human-readable name */
  abstract readonly name: string;

  /** Provider type (e.g., 'playwright', 'stagehand', 'browserbase') */
  abstract readonly provider: string;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Current lifecycle status */
  status: BrowserStatus = 'pending';

  /** Error message when status is 'error' */
  error?: string;

  /**
   * Whether the browser is running in headless mode.
   * Returns true by default if not explicitly configured.
   */
  get headless(): boolean {
    return this.config.headless ?? true;
  }

  /** Last known browser state before browser was closed (for restore on relaunch) */
  protected lastBrowserState?: BrowserState;

  /**
   * Shared manager instance for 'shared' scope mode.
   * Type varies by provider (e.g., BrowserManager for agent-browser, Stagehand for stagehand).
   * Providers should cast this to their specific type when accessing.
   */
  protected sharedManager: unknown = null;

  /** Configuration */
  protected readonly config: BrowserConfig;

  /**
   * Thread manager for handling thread-scoped browser sessions.
   * Set by subclasses that support thread isolation.
   */
  protected threadManager?: ThreadManager;

  /**
   * Current thread ID for browser operations.
   * Used by thread isolation to route operations to the correct session.
   */
  protected currentThreadId: string = DEFAULT_THREAD_ID;

  // ---------------------------------------------------------------------------
  // Screencast State
  // ---------------------------------------------------------------------------

  /** Default key for shared scope screencast streams */
  protected static readonly SHARED_STREAM_KEY = '__shared__';

  /** Active screencast streams per thread (for triggering reconnects on tab changes) */
  protected activeScreencastStreams = new Map<string, ScreencastStream>();

  /**
   * Get the stream key for a thread (or shared key for shared scope).
   * @param threadId - Optional thread ID
   * @returns The stream key to use for the screencast streams map
   */
  protected getStreamKey(threadId?: string): string {
    return threadId || MastraBrowser.SHARED_STREAM_KEY;
  }

  /**
   * Reconnect the active screencast for a specific thread.
   * Called internally when tabs are switched or closed.
   */
  protected async reconnectScreencastForThread(threadId: string | undefined, reason: string): Promise<void> {
    const streamKey = this.getStreamKey(threadId);
    const stream = this.activeScreencastStreams.get(streamKey);
    if (!stream || !stream.isActive()) {
      return;
    }

    // Check if browser is still running before attempting reconnect
    if (!this.isBrowserRunning()) {
      this.logger.debug?.('Skipping screencast reconnect - browser not running');
      return;
    }

    // For thread scope, also check if this specific thread still has a session
    const scope = this.getScope();
    if (scope === 'thread' && threadId && !this.threadManager?.getExistingManagerForThread(threadId)) {
      this.logger.debug?.(`Skipping screencast reconnect - no session for thread ${threadId}`);
      return;
    }

    this.logger.debug?.(`Reconnecting screencast: ${reason}`);

    try {
      // Small delay to let tab state settle
      await new Promise(resolve => setTimeout(resolve, 150));
      await stream.reconnect();

      // Emit the URL of the new active page after reconnecting
      const activePage = await this.getActivePage(threadId);
      if (activePage) {
        const url = activePage.url();
        if (url) {
          stream.emitUrl(url);
        }
      }
    } catch (error) {
      this.logger.debug?.('Screencast reconnect failed', error);
    }
  }

  /**
   * Update the browser state in the thread session.
   * Called on navigation, tab open/close to keep state fresh.
   */
  protected updateSessionBrowserState(threadId?: string): void {
    try {
      const effectiveThreadId = threadId ?? this.getCurrentThread() ?? DEFAULT_THREAD_ID;
      const state = this.getBrowserStateForThread(effectiveThreadId);
      if (state) {
        this.threadManager?.updateBrowserState(effectiveThreadId, state);
      }
    } catch {
      // Silently ignore errors during state update
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  private _launchPromise?: Promise<void>;
  private _closePromise?: Promise<void>;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(config: BrowserConfig = {}) {
    super({ name: 'MastraBrowser', component: RegisteredLogger.BROWSER });
    this.config = config;

    // Validate configuration: cdpUrl and scope: 'thread' are mutually exclusive
    // When connecting to an external browser via cdpUrl, we connect to a single existing browser.
    // Thread isolation requires spawning separate browser instances, which isn't possible with cdpUrl.
    // Note: The BrowserConfig type enforces this at compile-time, but we keep this runtime check
    // for better error messages when users bypass TypeScript (e.g., from JavaScript or casting).
    // We capture scope before checking cdpUrl to avoid TypeScript narrowing the union type.
    const scope = config.scope;
    if (config.cdpUrl && scope === 'thread') {
      throw new Error(
        'Invalid browser configuration: "cdpUrl" and "scope: \'thread\'" cannot be used together.\n\n' +
          '• cdpUrl connects to a single existing browser instance (all threads share it)\n' +
          '• scope: "thread" requires spawning separate browser instances per thread\n\n' +
          'To fix this, either:\n' +
          '1. Remove cdpUrl to let the provider spawn separate browser instances (supports thread isolation)\n' +
          '2. Use scope: "shared" when connecting via cdpUrl (all threads share one browser)',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Management
  // ---------------------------------------------------------------------------

  /**
   * Launch the browser. Override in subclass.
   * Called by launch() wrapper which handles status and race conditions.
   */
  protected abstract doLaunch(): Promise<void>;

  /**
   * Close the browser. Override in subclass.
   * Called by close() wrapper which handles status and race conditions.
   */
  protected abstract doClose(): Promise<void>;

  /**
   * Launch the browser.
   * Race-condition-safe - handles concurrent calls, status management, and lifecycle hooks.
   */
  async launch(): Promise<void> {
    // Already ready
    if (this.status === 'ready') {
      return;
    }

    // Already launching - wait for existing promise
    if (this.status === 'launching' && this._launchPromise) {
      return this._launchPromise;
    }

    // Can't launch if closing/closed
    if (this.status === 'closing' || this.status === 'closed') {
      throw new Error(`Cannot launch browser in '${this.status}' state`);
    }

    this.status = 'launching';
    this.error = undefined;

    this._launchPromise = (async () => {
      try {
        await this.doLaunch();
        this.status = 'ready';

        // Fire onLaunch hook
        if (this.config.onLaunch) {
          await this.config.onLaunch({ browser: this });
        }

        // Notify onBrowserReady callbacks
        this.notifyBrowserReady();
      } catch (err) {
        this.status = 'error';
        this.error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        this._launchPromise = undefined;
      }
    })();

    return this._launchPromise;
  }

  /**
   * Close the browser.
   * Race-condition-safe - handles concurrent calls, status management, and lifecycle hooks.
   */
  async close(): Promise<void> {
    // Already closed
    if (this.status === 'closed') {
      return;
    }

    // Already closing - wait for existing promise
    if (this.status === 'closing' && this._closePromise) {
      return this._closePromise;
    }

    // Wait for in-flight launch to complete before closing
    // This prevents race conditions where close() executes against a half-initialized provider
    if (this.status === 'launching' && this._launchPromise) {
      try {
        await this._launchPromise;
      } catch {
        // Launch failed - status is now 'error', nothing to close
        // Ensure we're in a clean closed state and return early
        this.status = 'closed';
        return;
      }
    }

    // Fire onClose hook before closing
    if (this.config.onClose && this.status === 'ready') {
      await this.config.onClose({ browser: this });
    }

    // Save browser state before closing for potential restore on relaunch
    const currentState = await this.getBrowserState();
    if (currentState && currentState.tabs.length > 0) {
      this.lastBrowserState = currentState;
    }

    this.status = 'closing';

    this._closePromise = (async () => {
      try {
        await this.doClose();
        this.status = 'closed';
        this.notifyBrowserClosed();
      } catch (err) {
        this.status = 'error';
        this.error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        this._closePromise = undefined;
      }
    })();

    return this._closePromise;
  }

  /**
   * Ensure the browser is ready, launching if needed.
   * If browser was previously closed, it will be re-launched.
   */
  async ensureReady(): Promise<void> {
    if (this.status === 'ready') {
      // Check if browser is still alive (handles external closure)
      // checkBrowserAlive() should save lastBrowserState internally if it detects closure
      const stillAlive = await this.checkBrowserAlive();
      if (stillAlive) {
        return;
      }
      // Browser was externally closed, mark as closed for re-launch
      this.status = 'closed';
    }
    if (this.status === 'pending' || this.status === 'error' || this.status === 'closed') {
      // Reset to pending to allow re-launch after close
      if (this.status === 'closed') {
        this.status = 'pending';
      }
      await this.launch();
      return;
    }
    if (this.status === 'launching') {
      await this._launchPromise;
      return;
    }
    if (this.status === 'closing') {
      // Wait for close to complete, then re-launch
      await this._closePromise;
      this.status = 'pending';
      await this.launch();
      return;
    }
    throw new Error(`Browser is ${this.status} and cannot be used`);
  }

  /**
   * Check if the browser is still alive.
   * Override in subclass to detect externally closed browsers.
   * @returns true if browser is alive, false if it was externally closed
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    // Default implementation assumes browser is alive if status is ready
    return true;
  }

  /**
   * Check if the browser is currently running.
   */
  isBrowserRunning(): boolean {
    return this.status === 'ready';
  }

  // ---------------------------------------------------------------------------
  // CDP URL Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve a CDP URL from a static string or async provider function.
   * @param cdpUrl - Static string or async function returning the CDP URL
   * @returns Resolved CDP URL string
   */
  protected async resolveCdpUrl(cdpUrl: CdpUrlProvider): Promise<string> {
    return typeof cdpUrl === 'function' ? await cdpUrl() : cdpUrl;
  }

  /**
   * Resolve an HTTP CDP endpoint to a WebSocket URL by fetching /json/version.
   *
   * Cloud browser providers (Browser-Use, Browserless, etc.) often expose HTTP
   * endpoints that need to be resolved to WebSocket URLs for direct CDP connections.
   *
   * - If the URL starts with `ws://` or `wss://`, returns it as-is
   * - If the URL starts with `http://` or `https://`, fetches /json/version to get webSocketDebuggerUrl
   *
   * @param url - CDP URL (HTTP or WebSocket)
   * @returns WebSocket URL for CDP connection
   */
  protected async resolveWebSocketUrl(url: string): Promise<string> {
    // Already a WebSocket URL
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }

    // HTTP URL - fetch /json/version to get the WebSocket URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
      const versionUrl = `${baseUrl}/json/version`;

      this.logger.debug?.(`Resolving WebSocket URL from ${versionUrl}`);

      // Add timeout to prevent hanging on dead endpoints
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(versionUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch CDP version info from ${versionUrl}: ${response.status} ${response.statusText}`,
          );
        }

        const data = (await response.json()) as { webSocketDebuggerUrl?: string };
        if (!data.webSocketDebuggerUrl) {
          throw new Error(`No webSocketDebuggerUrl found in CDP version response from ${versionUrl}`);
        }

        this.logger.debug?.(`Resolved WebSocket URL: ${data.webSocketDebuggerUrl}`);
        return data.webSocketDebuggerUrl;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Timeout resolving WebSocket URL from ${versionUrl} (10s)`);
        }
        throw error;
      }
    }

    // Unknown protocol - return as-is and let the caller handle it
    return url;
  }

  // ---------------------------------------------------------------------------
  // Disconnection Detection & Error Handling
  // ---------------------------------------------------------------------------

  /**
   * Error patterns that indicate browser disconnection.
   * Used by isDisconnectionError() to detect external browser closure.
   */
  protected static readonly DISCONNECTION_PATTERNS = [
    'Target closed',
    'Target page, context or browser has been closed',
    'Browser has been closed',
    'Connection closed',
    'Protocol error',
    'Session closed',
    'browser has disconnected',
    'closed externally',
  ];

  /**
   * Check if an error message indicates browser disconnection.
   * @param message - Error message to check
   * @returns true if the message indicates disconnection
   */
  isDisconnectionError(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return MastraBrowser.DISCONNECTION_PATTERNS.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Handle browser disconnection by updating status and notifying listeners.
   * Called when browser is detected as externally closed.
   *
   * For 'thread' scope: clears only the specific thread's session (other threads unaffected)
   * For 'shared' scope: clears the shared manager and updates global status
   */
  handleBrowserDisconnected(): void {
    const scope = this.threadManager?.getScope();
    const threadId = this.getCurrentThread();

    if (scope === 'thread' && threadId !== DEFAULT_THREAD_ID) {
      // Only clear the specific thread's session - other threads have independent browsers
      this.threadManager!.clearSession(threadId);
      this.logger.debug?.(`Cleared browser session for thread: ${threadId}`);
      // Notify only this thread's callbacks - do NOT set global status to 'closed'
      // since other threads may still have active browsers
      this.notifyBrowserClosed(threadId);
    } else {
      // For 'shared' scope or default thread, the shared browser is gone
      this.sharedManager = null;
      // Also clear the shared manager in the thread manager so getManagerForThread
      // doesn't return the dead manager
      this.threadManager?.clearSharedManager();
      // Update global status and notify all callbacks
      if (this.status !== 'closed') {
        this.status = 'closed';
        this.logger.debug?.('Browser was externally closed, status set to closed');
        this.notifyBrowserClosed();
      }
    }
  }

  /**
   * Create a BrowserToolError from an exception.
   * Handles common error patterns including disconnection detection.
   * Subclasses can override to add provider-specific error handling.
   *
   * @param error - The caught error
   * @param context - Description of what operation failed (e.g., "Click operation")
   * @returns Structured BrowserToolError
   */
  protected createErrorFromException(error: unknown, context: string): BrowserToolError {
    const msg = error instanceof Error ? error.message : String(error);

    // Check for browser disconnection errors first
    if (this.isDisconnectionError(msg)) {
      this.handleBrowserDisconnected();
      return createError(
        'browser_closed',
        'Browser was closed externally.',
        'The browser window was closed. Please retry to re-launch.',
      );
    }

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted')) {
      return createError('timeout', `${context} timed out.`, 'Try again or increase timeout.');
    }

    // Not launched errors
    if (msg.includes('not launched') || msg.includes('Browser is not launched')) {
      return createError(
        'browser_error',
        'Browser was not initialized.',
        'This is an internal error - please try again.',
      );
    }

    // Default to generic browser error
    return createError('browser_error', `${context} failed: ${msg}`, 'Check the browser state and try again.');
  }

  /**
   * Create a specific error type.
   * Convenience method for providers to create typed errors.
   */
  protected createError(code: ErrorCode, message: string, hint?: string): BrowserToolError {
    return createError(code, message, hint);
  }

  // ---------------------------------------------------------------------------
  // Browser Ready/Closed Callbacks
  // ---------------------------------------------------------------------------

  private _onReadyCallbacks: Set<() => void> = new Set();
  private _onClosedCallbacks: Set<() => void> = new Set();
  /** Thread-specific ready callbacks. Key is threadId. */
  private _onThreadReadyCallbacks: Map<string, Set<() => void>> = new Map();
  /** Thread-specific closed callbacks. Key is threadId. */
  private _onThreadClosedCallbacks: Map<string, Set<() => void>> = new Map();

  /**
   * Register a callback to be invoked when the browser becomes ready.
   * If browser is already running, callback is invoked immediately.
   * The callback is ALWAYS registered (even if invoked immediately) so it will
   * also fire on future "ready" events (e.g., session creation for thread isolation).
   * @param callback - Function to call when browser is ready
   * @param threadId - Optional thread ID to scope the callback to a specific thread
   * @returns Cleanup function to unregister the callback
   */
  onBrowserReady(callback: () => void, threadId?: string): () => void {
    if (threadId) {
      // Thread-specific callback
      let threadCallbacks = this._onThreadReadyCallbacks.get(threadId);
      if (!threadCallbacks) {
        threadCallbacks = new Set();
        this._onThreadReadyCallbacks.set(threadId, threadCallbacks);
      }
      threadCallbacks.add(callback);

      // Check if this specific thread has a session ready
      if (this.hasThreadSession(threadId)) {
        callback();
      }

      return () => {
        threadCallbacks!.delete(callback);
        if (threadCallbacks!.size === 0) {
          this._onThreadReadyCallbacks.delete(threadId);
        }
      };
    }

    // Global callback (for shared scope or when thread not specified)
    this._onReadyCallbacks.add(callback);

    if (this.isBrowserRunning()) {
      // Browser already ready - also invoke immediately
      callback();
    }

    return () => {
      this._onReadyCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback to be invoked when the browser closes.
   * Useful for screencast to broadcast browser_closed status.
   * @param callback - Function to call when browser closes
   * @param threadId - Optional thread ID to scope the callback to a specific thread
   * @returns Cleanup function to unregister the callback
   */
  onBrowserClosed(callback: () => void, threadId?: string): () => void {
    if (threadId) {
      // Thread-specific callback
      let threadCallbacks = this._onThreadClosedCallbacks.get(threadId);
      if (!threadCallbacks) {
        threadCallbacks = new Set();
        this._onThreadClosedCallbacks.set(threadId, threadCallbacks);
      }
      threadCallbacks.add(callback);
      return () => {
        threadCallbacks!.delete(callback);
        if (threadCallbacks!.size === 0) {
          this._onThreadClosedCallbacks.delete(threadId);
        }
      };
    }
    // Global callback (for shared scope or when thread not specified)
    this._onClosedCallbacks.add(callback);
    return () => {
      this._onClosedCallbacks.delete(callback);
    };
  }

  /**
   * Notify registered callbacks that browser is ready.
   * @param threadId - If provided, only notify callbacks for that thread (for thread scope)
   */
  protected notifyBrowserReady(threadId?: string): void {
    if (threadId) {
      // Notify thread-specific callbacks only
      const threadCallbacks = this._onThreadReadyCallbacks.get(threadId);
      if (threadCallbacks) {
        for (const callback of threadCallbacks) {
          try {
            callback();
          } catch {
            // Intentionally swallowed - callbacks should not crash the browser
          }
        }
      }
    } else {
      // Notify global callbacks (for shared scope)
      for (const callback of this._onReadyCallbacks) {
        try {
          callback();
        } catch {
          // Intentionally swallowed - callbacks should not crash the browser
        }
      }
      // Also notify ALL thread callbacks (entire browser is ready - shared scenario)
      for (const [, threadCallbacks] of this._onThreadReadyCallbacks) {
        for (const callback of threadCallbacks) {
          try {
            callback();
          } catch {
            // Intentionally swallowed - callbacks should not crash the browser
          }
        }
      }
    }
    // Do NOT clear callbacks - they should persist across browser restarts
    // so screencast can reconnect after external closure + re-launch
  }

  /**
   * Notify registered callbacks that browser has closed.
   * @param threadId - If provided, only notify callbacks for that thread (for thread scope)
   */
  protected notifyBrowserClosed(threadId?: string): void {
    if (threadId) {
      // Notify thread-specific callbacks only
      const threadCallbacks = this._onThreadClosedCallbacks.get(threadId);
      if (threadCallbacks) {
        for (const callback of threadCallbacks) {
          try {
            callback();
          } catch {
            // Intentionally swallowed - callbacks should not crash the browser
          }
        }
      }
    } else {
      // Notify global callbacks (for shared scope)
      for (const callback of this._onClosedCallbacks) {
        try {
          callback();
        } catch {
          // Intentionally swallowed - callbacks should not crash the browser
        }
      }
      // Also notify ALL thread callbacks (entire browser is closing)
      for (const [, threadCallbacks] of this._onThreadClosedCallbacks) {
        for (const callback of threadCallbacks) {
          try {
            callback();
          } catch {
            // Intentionally swallowed - callbacks should not crash the browser
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // URL Access (optional - providers that support it should override)
  // ---------------------------------------------------------------------------

  /**
   * Get the current page URL without launching the browser.
   * @param threadId - Optional thread ID for thread-isolated browsers
   * @returns The current URL string, or null if browser is not running or not supported
   */
  async getCurrentUrl(_threadId?: string): Promise<string | null> {
    return null;
  }

  /**
   * Get the current browser state (all tabs and active tab index).
   * Override in subclass to provide actual tab state.
   * @param _threadId - Optional thread ID for thread-isolated sessions
   * @returns The browser state, or null if not available
   */
  async getBrowserState(_threadId?: string): Promise<BrowserState | null> {
    // Default implementation returns null - providers override
    return null;
  }

  /**
   * Get the last known browser state before the browser was closed.
   * Useful for restoring state on relaunch.
   * @param threadId - Optional thread ID for thread-isolated sessions
   * @returns The last browser state, or undefined if not available
   */
  getLastBrowserState(threadId?: string): BrowserState | undefined {
    // For thread isolation, check thread manager first
    if (threadId && this.threadManager) {
      const savedState = this.threadManager.getSavedBrowserState(threadId);
      if (savedState) {
        return savedState;
      }
    }
    return this.lastBrowserState;
  }

  /**
   * Get all open tabs with their URLs and titles.
   * Override in subclass to provide actual tab info.
   * @param _threadId - Optional thread ID for thread-isolated sessions
   * @returns Array of tab states
   */
  async getTabState(_threadId?: string): Promise<BrowserTabState[]> {
    // Default implementation returns empty array - providers override
    return [];
  }

  /**
   * Get the active tab index.
   * Override in subclass to provide actual active tab index.
   * @param _threadId - Optional thread ID for thread-isolated sessions
   * @returns The active tab index (0-based), or 0 if not available
   */
  async getActiveTabIndex(_threadId?: string): Promise<number> {
    // Default implementation returns 0 - providers override
    return 0;
  }

  /**
   * Navigate to a URL (simple form). Override in subclass if supported.
   * Used internally for restoring state on relaunch.
   * Named `navigateTo` to avoid conflicts with tool methods that have richer signatures.
   */
  async navigateTo(_url: string): Promise<void> {
    // Default implementation does nothing - providers can override
  }

  // ---------------------------------------------------------------------------
  // Thread Management
  // ---------------------------------------------------------------------------

  /**
   * Set the current thread ID for subsequent browser operations.
   * Called by tools before executing browser actions to ensure
   * operations are routed to the correct thread session.
   *
   * @param threadId - The thread ID, or undefined to use the default thread
   */
  setCurrentThread(threadId?: string): void {
    this.currentThreadId = threadId ?? DEFAULT_THREAD_ID;
  }

  /**
   * Get the current thread ID.
   * @returns The current thread ID being used for operations
   */
  getCurrentThread(): string {
    return this.currentThreadId;
  }

  /**
   * Get the browser scope mode.
   * @returns The scope from threadManager or config, defaults to 'shared'
   */
  getScope(): BrowserScope {
    return this.threadManager?.getScope() ?? this.config.scope ?? 'shared';
  }

  // ---------------------------------------------------------------------------
  // Screencast (optional - for Studio live view)
  // ---------------------------------------------------------------------------

  /**
   * Start screencast streaming. Override in subclass if supported.
   */
  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    throw new Error('Screencast not supported by this provider');
  }

  /**
   * Check if a thread has an existing browser session.
   * Used by startScreencastIfBrowserActive to prevent showing another thread's page.
   *
   * If threadManager is set, delegates to it. Otherwise returns true (no isolation).
   * Subclasses can override for custom behavior.
   *
   * @returns true if session exists or thread isolation is not used
   */
  hasThreadSession(threadId: string): boolean {
    if (!this.threadManager) {
      // No thread manager - all threads share the same session
      return true;
    }

    const scope = this.threadManager.getScope();

    // Shared scope - all threads share the same session
    if (scope === 'shared') {
      return true;
    }

    // Check if this thread has an actual session
    return this.threadManager.hasSession(threadId);
  }

  /**
   * Close a specific thread's browser session.
   * Delegates to ThreadManager and notifies registered callbacks.
   *
   * For 'thread' scope, this closes only that thread's browser instance.
   * For 'shared' scope, this is a no-op (use close() to close the shared browser).
   *
   * @param threadId - The thread ID whose session should be closed
   */
  async closeThreadSession(threadId: string): Promise<void> {
    if (!this.threadManager) {
      return;
    }
    await this.threadManager.destroySession(threadId);
    // Notify callbacks registered for this specific thread
    this.notifyBrowserClosed(threadId);
  }

  /**
   * Handle browser disconnection for a specific thread.
   * Called when a thread's browser is closed externally (e.g., user closes browser window).
   * Clears the thread session and notifies registered callbacks.
   *
   * @param threadId - The thread ID whose session was disconnected
   */
  protected handleThreadBrowserDisconnected(threadId: string): void {
    if (!this.threadManager) {
      return;
    }
    this.threadManager.clearSession(threadId);
    this.logger.debug?.(`Cleared browser session for thread: ${threadId}`);
    // Notify only the callbacks registered for this specific thread
    this.notifyBrowserClosed(threadId);
  }

  /**
   * Get a session identifier for a specific thread.
   * In thread scope, returns a composite ID (browser:threadId).
   * In shared scope or without thread manager, returns the browser instance ID.
   */
  getSessionId(threadId?: string): string {
    if (!threadId || !this.threadManager) {
      return this.id;
    }

    const scope = this.threadManager.getScope();

    // Shared scope - all threads share the same session
    if (scope === 'shared') {
      return this.id;
    }

    // Thread scope - return composite ID
    return `${this.id}:${threadId}`;
  }

  /**
   * Start screencast only if browser is already running.
   * Does NOT launch the browser.
   * Uses config.screencast options as defaults if no options provided.
   *
   * For thread-isolated browsers ('browser' mode):
   * - Returns null if the thread doesn't have an existing browser session
   */
  async startScreencastIfBrowserActive(options?: ScreencastOptions): Promise<ScreencastStream | null> {
    if (!this.isBrowserRunning()) {
      return null;
    }

    // Merge config screencast defaults with call-site overrides
    const mergedOptions = this.config.screencast || options ? { ...this.config.screencast, ...options } : undefined;

    const threadId = mergedOptions?.threadId;
    const scope = this.threadManager?.getScope() ?? this.config.scope ?? 'shared';

    // Shared scope - just start the screencast
    if (scope === 'shared') {
      return this.startScreencast(mergedOptions);
    }

    // For 'thread' scope, only start if the thread has an existing session
    if (threadId && !this.hasThreadSession(threadId)) {
      return null;
    }

    return this.startScreencast(mergedOptions);
  }

  // ---------------------------------------------------------------------------
  // Event Injection (optional - for Studio live view)
  // ---------------------------------------------------------------------------

  /**
   * Inject a mouse event. Override in subclass if supported.
   * @param event - Mouse event parameters
   * @param threadId - Optional thread ID for thread-isolated sessions
   */
  async injectMouseEvent(_event: MouseEventParams, _threadId?: string): Promise<void> {
    throw new Error('Mouse event injection not supported by this provider');
  }

  /**
   * Inject a keyboard event. Override in subclass if supported.
   * @param event - Keyboard event parameters
   * @param threadId - Optional thread ID for thread-isolated sessions
   */
  async injectKeyboardEvent(_event: KeyboardEventParams, _threadId?: string): Promise<void> {
    throw new Error('Keyboard event injection not supported by this provider');
  }

  // ---------------------------------------------------------------------------
  // Abstract Methods (providers must implement)
  // ---------------------------------------------------------------------------

  /**
   * Get the active page for a thread.
   * Used by screencast reconnection to emit the current URL.
   *
   * @param threadId - Optional thread ID (uses current thread if not provided)
   * @returns The active Playwright Page, or null if not available
   */
  protected abstract getActivePage(threadId?: string): Promise<{ url(): string } | null>;

  /**
   * Get the current browser state for a thread.
   * Used to persist and restore browser state across sessions.
   *
   * @param threadId - Optional thread ID (uses current thread if not provided)
   * @returns Browser state including URL, tabs, and active tab index
   */
  protected abstract getBrowserStateForThread(threadId?: string): BrowserState | null;

  // ---------------------------------------------------------------------------
  // Input Processors
  // ---------------------------------------------------------------------------

  /**
   * Returns browser input processors (e.g., BrowserContextProcessor for context injection).
   * Skips if the user already added a processor with the same id.
   *
   * This method is similar to AgentChannels.getInputProcessors() and allows
   * browser implementations to provide their own processors.
   *
   * @param configuredProcessors - Processors already configured by the user (for deduplication)
   * @returns Array of input processors for this browser instance
   */
  getInputProcessors(configuredProcessors: InputProcessorOrWorkflow[] = []): InputProcessor[] {
    const hasProcessor = configuredProcessors.some(
      p => !isProcessorWorkflow(p) && 'id' in p && p.id === 'browser-context',
    );
    if (hasProcessor) return [];
    return [new BrowserContextProcessor()];
  }

  // ---------------------------------------------------------------------------
  // Abstract Methods - Must be implemented by providers
  // ---------------------------------------------------------------------------

  /**
   * Get the browser tools for this provider.
   *
   * Each provider returns its own set of tools. For example:
   * - AgentBrowser returns 17 deterministic tools using refs
   * - StagehandBrowser might return AI-powered tools (act, extract, observe)
   *
   * @returns Record of tool name to tool definition
   */
  abstract getTools(): Record<string, Tool<any, any>>;
}
