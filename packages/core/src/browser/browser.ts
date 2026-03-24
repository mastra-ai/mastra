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

    this.status = 'closing';

    this._closePromise = (async () => {
      try {
        await this.doClose();
        this.status = 'closed';
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
      return;
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
   * Check if the browser is currently running.
   */
  isBrowserRunning(): boolean {
    return this.status === 'ready';
  }

  // ---------------------------------------------------------------------------
  // Browser Ready Callbacks
  // ---------------------------------------------------------------------------

  private _onReadyCallbacks: Set<() => void> = new Set();

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
   * Notify all registered callbacks that browser is ready.
   * Called internally after launch completes.
   */
  protected notifyBrowserReady(): void {
    for (const callback of this._onReadyCallbacks) {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    }
    this._onReadyCallbacks.clear();
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
