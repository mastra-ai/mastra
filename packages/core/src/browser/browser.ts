/**
 * MastraBrowser Base Class
 *
 * Abstract base class for browser providers. Extends MastraBase for logger integration.
 *
 * ## Architecture
 *
 * Each browser capability is exposed as a single method that handles multiple actions.
 * Providers implement these methods using whatever low-level approach they need.
 *
 * For example, `navigate()` handles goto, back, forward, reload, and close actions.
 * An AgentBrowser provider uses Playwright internally, while a StagehandBrowser
 * might use AI-powered navigation.
 *
 * ## Two Paradigms
 *
 * Browser providers fall into two paradigms:
 *
 * 1. **Deterministic** (Playwright, agent-browser) - Uses refs (@e1, @e2) and selectors
 * 2. **AI-powered** (Stagehand) - Uses natural language instructions
 *
 * Both can extend this base class - they just implement the methods differently.
 *
 * @example
 * ```typescript
 * class AgentBrowser extends MastraBrowser {
 *   async navigate(input) {
 *     switch (input.action) {
 *       case 'goto':
 *         await this.page.goto(input.url);
 *         return { success: true, url: this.page.url(), title: await this.page.title() };
 *       case 'back':
 *         await this.page.goBack();
 *         return { success: true, url: this.page.url() };
 *       // ... etc
 *     }
 *   }
 * }
 * ```
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';

import type {
  NavigateInput,
  InteractInput,
  InputInput,
  KeyboardInput,
  FormInput,
  ScrollInput,
  ExtractInput,
  ElementStateInput,
  BrowserStateInput,
  StorageInput,
  EmulationInput,
  FramesInput,
  DialogsInput,
  TabsInput,
  RecordingInput,
  MonitoringInput,
  ClipboardInput,
  DebugInput,
  WaitInput,
} from './schemas';

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
// Screencast Types
// =============================================================================

/**
 * Options for starting a screencast stream.
 */
export interface ScreencastOptions {
  /** Image format */
  format?: 'jpeg' | 'png';
  /** Quality (0-100, for jpeg) */
  quality?: number;
  /** Max width in pixels */
  maxWidth?: number;
  /** Max height in pixels */
  maxHeight?: number;
  /** Capture every Nth frame */
  everyNthFrame?: number;
}

/**
 * A screencast stream that emits frames.
 */
export interface ScreencastStream {
  /** Stop the screencast */
  stop(): Promise<void>;
  /** Register a frame handler */
  onFrame(callback: (frame: { data: string; timestamp: number }) => void): void;
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
 * Each method corresponds to a grouped tool and handles multiple actions.
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
   * Called by _launch() wrapper which handles status and race conditions.
   */
  protected abstract launch(): Promise<void>;

  /**
   * Close the browser. Override in subclass.
   * Called by _close() wrapper which handles status and race conditions.
   */
  protected abstract close(): Promise<void>;

  /**
   * Race-condition-safe launch wrapper.
   * Handles concurrent calls, status management, and lifecycle hooks.
   */
  async _launch(): Promise<void> {
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
        await this.launch();
        this.status = 'ready';

        // Fire onLaunch hook
        if (this.config.onLaunch) {
          await this.config.onLaunch({ browser: this });
        }
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
   * Race-condition-safe close wrapper.
   * Handles concurrent calls, status management, and lifecycle hooks.
   */
  async _close(): Promise<void> {
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
        await this.close();
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
   */
  async ensureReady(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }
    if (this.status === 'pending' || this.status === 'error') {
      await this._launch();
      return;
    }
    if (this.status === 'launching') {
      await this._launchPromise;
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
  // Abstract Browser Methods (one per grouped tool)
  // ---------------------------------------------------------------------------

  /**
   * Navigation actions: goto, back, forward, reload, close
   */
  abstract navigate(input: NavigateInput): Promise<unknown>;

  /**
   * Interaction actions: click, double_click, hover, focus, drag, tap
   */
  abstract interact(input: InteractInput): Promise<unknown>;

  /**
   * Text input actions: fill, type, press, clear, select_all
   */
  abstract input(input: InputInput): Promise<unknown>;

  /**
   * Keyboard actions: type, insert_text, key_down, key_up
   */
  abstract keyboard(input: KeyboardInput): Promise<unknown>;

  /**
   * Form actions: select, check, uncheck, upload
   */
  abstract form(input: FormInput): Promise<unknown>;

  /**
   * Scroll actions: scroll, scroll_into_view
   */
  abstract scroll(input: ScrollInput): Promise<unknown>;

  /**
   * Data extraction: snapshot, screenshot, text, html, value, attribute, title, url, count, bounding_box, styles, evaluate
   */
  abstract extract(input: ExtractInput): Promise<unknown>;

  /**
   * Element state checks: is_visible, is_enabled, is_checked
   */
  abstract elementState(input: ElementStateInput): Promise<unknown>;

  /**
   * Browser state: set_viewport, set_credentials, get_cookies, set_cookie, clear_cookies
   */
  abstract browserState(input: BrowserStateInput): Promise<unknown>;

  /**
   * Storage operations: get, set, clear (localStorage and sessionStorage)
   */
  abstract storage(input: StorageInput): Promise<unknown>;

  /**
   * Device emulation: set_device, set_media, set_geolocation, set_offline, set_headers
   */
  abstract emulation(input: EmulationInput): Promise<unknown>;

  /**
   * Frame management: switch, main
   */
  abstract frames(input: FramesInput): Promise<unknown>;

  /**
   * Dialog handling: handle, clear
   */
  abstract dialogs(input: DialogsInput): Promise<unknown>;

  /**
   * Tab management: list, new, switch, close
   */
  abstract tabs(input: TabsInput): Promise<unknown>;

  /**
   * Recording and tracing: start_recording, stop_recording, start_tracing, stop_tracing
   */
  abstract recording(input: RecordingInput): Promise<unknown>;

  /**
   * Monitoring: network_start/get/clear, console_start/get/clear, errors_start/get/clear
   */
  abstract monitoring(input: MonitoringInput): Promise<unknown>;

  /**
   * Clipboard operations: copy, paste, read, write
   */
  abstract clipboard(input: ClipboardInput): Promise<unknown>;

  /**
   * Debugging: inspect, highlight
   */
  abstract debug(input: DebugInput): Promise<unknown>;

  /**
   * Wait for conditions: selector, timeout, function
   */
  abstract wait(input: WaitInput): Promise<unknown>;
}
