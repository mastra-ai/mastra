/**
 * MastraBrowser Base Class
 *
 * Abstract base class for browser providers. Extends MastraBase for logger integration.
 *
 * ## Architecture
 *
 * Each browser capability is exposed as a single method with a flat input schema.
 * Providers implement these methods using whatever low-level approach they need.
 *
 * There are 17 flat tools:
 * - Core (9): goto, snapshot, click, type, press, select, scroll, screenshot, close
 * - Extended (7): hover, back, upload, dialog, wait, tabs, drag
 * - Escape Hatch (1): evaluate
 *
 * ## Two Paradigms
 *
 * Browser providers fall into two paradigms:
 *
 * 1. **Deterministic** (Playwright, agent-browser) - Uses refs (@e1, @e2) and selectors
 * 2. **AI-powered** (Stagehand) - Uses natural language instructions
 *
 * Both can extend this base class - they just implement the methods differently.
 */

import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';

import type {
  GotoInput,
  SnapshotInput,
  ClickInput,
  TypeInput,
  PressInput,
  SelectInput,
  ScrollInput,
  ScreenshotInput,
  HoverInput,
  UploadInput,
  DialogInput,
  WaitInput,
  TabsInput,
  DragInput,
  EvaluateInput,
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
   */
  async ensureReady(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }
    if (this.status === 'pending' || this.status === 'error') {
      await this.launch();
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
  // Abstract Browser Methods — Core (9)
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL.
   */
  abstract goto(input: GotoInput): Promise<unknown>;

  /**
   * Get accessibility tree snapshot.
   */
  abstract snapshot(input: SnapshotInput): Promise<unknown>;

  /**
   * Click an element.
   */
  abstract click(input: ClickInput): Promise<unknown>;

  /**
   * Type text into an element.
   */
  abstract type(input: TypeInput): Promise<unknown>;

  /**
   * Press a keyboard key.
   */
  abstract press(input: PressInput): Promise<unknown>;

  /**
   * Select an option from a dropdown.
   */
  abstract select(input: SelectInput): Promise<unknown>;

  /**
   * Scroll the page or element.
   */
  abstract scroll(input: ScrollInput): Promise<unknown>;

  /**
   * Take a screenshot.
   */
  abstract screenshot(input: ScreenshotInput): Promise<unknown>;

  // Note: close() is already defined as a lifecycle method above

  // ---------------------------------------------------------------------------
  // Abstract Browser Methods — Extended (7)
  // ---------------------------------------------------------------------------

  /**
   * Hover over an element.
   */
  abstract hover(input: HoverInput): Promise<unknown>;

  /**
   * Go back in browser history.
   */
  abstract back(): Promise<unknown>;

  /**
   * Upload file(s) to a file input.
   */
  abstract upload(input: UploadInput): Promise<unknown>;

  /**
   * Handle browser dialogs.
   */
  abstract dialog(input: DialogInput): Promise<unknown>;

  /**
   * Wait for an element or condition.
   */
  abstract wait(input: WaitInput): Promise<unknown>;

  /**
   * Manage browser tabs.
   */
  abstract tabs(input: TabsInput): Promise<unknown>;

  /**
   * Drag an element to another element.
   */
  abstract drag(input: DragInput): Promise<unknown>;

  // ---------------------------------------------------------------------------
  // Abstract Browser Methods — Escape Hatch (1)
  // ---------------------------------------------------------------------------

  /**
   * Execute JavaScript in the browser.
   */
  abstract evaluate(input: EvaluateInput): Promise<unknown>;
}
