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
import type { Tool } from '../tools/tool';
import { createError } from './errors';
import type { BrowserToolError, ErrorCode } from './errors';

// Re-export screencast types from the screencast module
import type { ScreencastOptions as ScreencastOptionsType } from './screencast/types';
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
 * Base configuration shared by all browser providers.
 * Provider packages extend this with their own options.
 */
export interface BrowserConfig {
  /**
   * Whether to run the browser in headless mode (no visible UI).
   * @default true
   */
  headless?: boolean;

  /**
   * Default timeout in milliseconds for browser operations.
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * CDP WebSocket URL or async provider function.
   * When provided, connects to an existing browser instead of launching a new one.
   * Useful for cloud providers (Browserbase, Browserless, Kernel, etc.).
   */
  cdpUrl?: CdpUrlProvider;

  /**
   * Called after the browser reaches 'ready' status.
   */
  onLaunch?: BrowserLifecycleHook;

  /**
   * Called before the browser is closed.
   */
  onClose?: BrowserLifecycleHook;
}

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
  /** Register event handlers */
  on(event: 'frame', handler: (frame: { data: string; viewport: { width: number; height: number } }) => void): this;
  on(event: 'stop', handler: (reason: string) => void): this;
  on(event: 'error', handler: (error: Error) => void): this;
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

  /** Last known URL before browser was closed (for restore on relaunch) */
  protected lastUrl?: string;

  /** Configuration */
  protected readonly config: BrowserConfig;

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

    // Fire onClose hook before closing
    if (this.config.onClose && this.status === 'ready') {
      await this.config.onClose({ browser: this });
    }

    // Save last URL before closing for potential restore on relaunch
    const currentUrl = this.getCurrentUrl();
    if (currentUrl && currentUrl !== 'about:blank') {
      this.lastUrl = currentUrl;
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
      // checkBrowserAlive() should save lastUrl internally if it detects closure
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
   * Subclasses should call this and also clear their internal instance references.
   */
  handleBrowserDisconnected(): void {
    if (this.status !== 'closed') {
      this.status = 'closed';
      this.logger.debug?.('Browser was externally closed, status set to closed');
      this.notifyBrowserClosed();
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
  // Browser Ready Callbacks
  // ---------------------------------------------------------------------------

  private _onReadyCallbacks: Set<() => void> = new Set();
  private _onClosedCallbacks: Set<() => void> = new Set();

  /**
   * Register a callback to be invoked when the browser becomes ready.
   * If browser is already running, callback is invoked immediately.
   * @returns Cleanup function to unregister the callback
   */
  onBrowserReady(callback: () => void): () => void {
    if (this.isBrowserRunning()) {
      // Browser already ready - invoke immediately
      callback();
      return () => {};
    }

    this._onReadyCallbacks.add(callback);
    return () => {
      this._onReadyCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback to be invoked when the browser closes.
   * Useful for screencast to broadcast browser_closed status.
   * @returns Cleanup function to unregister the callback
   */
  onBrowserClosed(callback: () => void): () => void {
    this._onClosedCallbacks.add(callback);
    return () => {
      this._onClosedCallbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks that browser is ready.
   * Called internally after launch completes.
   * Note: Callbacks remain registered and will fire again on subsequent launches.
   * This supports browser restart scenarios (e.g., external close + re-launch).
   */
  protected notifyBrowserReady(): void {
    for (const callback of this._onReadyCallbacks) {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    }
    // Do NOT clear callbacks - they should persist across browser restarts
    // so screencast can reconnect after external closure + re-launch
  }

  /**
   * Notify all registered callbacks that browser has closed.
   * Called by handleBrowserDisconnected() and close().
   */
  protected notifyBrowserClosed(): void {
    for (const callback of this._onClosedCallbacks) {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    }
  }

  // ---------------------------------------------------------------------------
  // URL Access (optional - providers that support it should override)
  // ---------------------------------------------------------------------------

  /**
   * Get the current page URL without launching the browser.
   * @returns The current URL string, or null if browser is not running or not supported
   */
  getCurrentUrl(): string | null {
    return null;
  }

  /**
   * Get the last known URL before the browser was closed.
   * Useful for restoring state on relaunch.
   * @returns The last URL string, or undefined if not available
   */
  getLastUrl(): string | undefined {
    return this.lastUrl;
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
  // Screencast (optional - for Studio live view)
  // ---------------------------------------------------------------------------

  /**
   * Start screencast streaming. Override in subclass if supported.
   */
  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    throw new Error('Screencast not supported by this provider');
  }

  /**
   * Start screencast only if browser is already running.
   * Does NOT launch the browser.
   */
  async startScreencastIfBrowserActive(options?: ScreencastOptions): Promise<ScreencastStream | null> {
    if (!this.isBrowserRunning()) {
      return null;
    }
    return this.startScreencast(options);
  }

  // ---------------------------------------------------------------------------
  // Event Injection (optional - for Studio live view)
  // ---------------------------------------------------------------------------

  /**
   * Inject a mouse event. Override in subclass if supported.
   */
  async injectMouseEvent(_event: MouseEventParams): Promise<void> {
    throw new Error('Mouse event injection not supported by this provider');
  }

  /**
   * Inject a keyboard event. Override in subclass if supported.
   */
  async injectKeyboardEvent(_event: KeyboardEventParams): Promise<void> {
    throw new Error('Keyboard event injection not supported by this provider');
  }

  // ---------------------------------------------------------------------------
  // Abstract Tools Method
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
