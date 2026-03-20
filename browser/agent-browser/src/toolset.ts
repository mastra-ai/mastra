import type { ToolAction } from '@mastra/core/tools';

import type { BrowserManagerLike } from './browser-types.js';

import { ScreencastStream } from './screencast/index.js';
import type { ScreencastOptions } from './screencast/index.js';
import { createCheckTool } from './tools/check.js';
import { createClickTool } from './tools/click.js';
import { createCloseTool } from './tools/close.js';
import { createClearCookiesTool, createGetCookiesTool, createSetCookieTool } from './tools/cookies.js';
import { createDoubleClickTool } from './tools/double-click.js';
import { createDragTool } from './tools/drag.js';
import { createEvaluateTool } from './tools/evaluate.js';
import { createFillTool } from './tools/fill.js';
import { createFocusTool } from './tools/focus.js';
import { createGetTextTool } from './tools/get-text.js';
import { createHoverTool } from './tools/hover.js';
import { createNavigateTool } from './tools/navigate.js';
import { createGoBackTool, createGoForwardTool, createReloadTool } from './tools/navigation.js';
import { createPressTool } from './tools/press.js';
import { createScreenshotTool } from './tools/screenshot.js';
import { createScrollIntoViewTool } from './tools/scroll-into-view.js';
import { createScrollTool } from './tools/scroll.js';
import { createSelectTool } from './tools/select.js';
import { createSetViewportTool } from './tools/set-viewport.js';
import { createSnapshotTool } from './tools/snapshot.js';
import { createTypeTool } from './tools/type.js';
import { createWaitTool } from './tools/wait.js';
import type { BrowserConfig } from './types.js';

/**
 * Browser provides browser automation tools for Mastra agents.
 *
 * Implements the BrowserToolsetLike interface from @mastra/core so it can be
 * registered as `browser` on an agent. The browser is initialized lazily on
 * first tool use, not at construction time, to avoid startup costs.
 *
 * @example
 * ```typescript
 * import { Browser } from '@mastra/agent-browser';
 *
 * const browser = new Browser({ headless: true });
 * const agent = new Agent({
 *   browser,
 *   // ...
 * });
 * ```
 */
export class Browser {
  readonly name = 'agent-browser';

  /** The browser manager instance, lazily initialized */
  private browserManager: BrowserManagerLike | null = null;

  /** Promise that resolves to the browser, used to prevent concurrent launches */
  private launchPromise: Promise<BrowserManagerLike> | null = null;

  /** Callbacks to invoke when browser becomes ready */
  private onBrowserReadyCallbacks = new Set<() => void>();

  /** Configuration for the browser */
  private config: Required<BrowserConfig>;

  /** Tools record for the agent */
  readonly tools: Record<string, ToolAction<any, any, any, any>>;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 10_000,
    };

    const getBrowser = () => this.getBrowser();
    const timeout = this.config.timeout;

    this.tools = {
      // Core navigation & inspection
      browser_navigate: createNavigateTool(getBrowser, timeout),
      browser_snapshot: createSnapshotTool(getBrowser),
      browser_screenshot: createScreenshotTool(getBrowser, 30_000),
      browser_close: createCloseTool(() => this.close()),

      // Click & interaction
      browser_click: createClickTool(getBrowser, timeout),
      browser_double_click: createDoubleClickTool(getBrowser, timeout),
      browser_hover: createHoverTool(getBrowser, timeout),
      browser_focus: createFocusTool(getBrowser, timeout),
      browser_drag: createDragTool(getBrowser, timeout),

      // Text input
      browser_type: createTypeTool(getBrowser, timeout),
      browser_fill: createFillTool(getBrowser, timeout),
      browser_press: createPressTool(getBrowser),

      // Form controls
      browser_select: createSelectTool(getBrowser, timeout),
      browser_check: createCheckTool(getBrowser, timeout),

      // Scrolling
      browser_scroll: createScrollTool(getBrowser),
      browser_scroll_into_view: createScrollIntoViewTool(getBrowser, timeout),

      // Data extraction
      browser_get_text: createGetTextTool(getBrowser, timeout),
      browser_evaluate: createEvaluateTool(getBrowser),

      // Navigation history
      browser_go_back: createGoBackTool(getBrowser, timeout),
      browser_go_forward: createGoForwardTool(getBrowser, timeout),
      browser_reload: createReloadTool(getBrowser, timeout),

      // Browser state
      browser_set_viewport: createSetViewportTool(getBrowser),
      browser_get_cookies: createGetCookiesTool(getBrowser),
      browser_set_cookie: createSetCookieTool(getBrowser),
      browser_clear_cookies: createClearCookiesTool(getBrowser),

      // Waiting
      browser_wait: createWaitTool(getBrowser, timeout),
    };
  }

  /**
   * Get or lazily initialize the browser.
   * Uses a singleton promise to prevent concurrent launches.
   */
  private async getBrowser(): Promise<BrowserManagerLike> {
    if (this.browserManager) {
      return this.browserManager;
    }

    if (!this.launchPromise) {
      this.launchPromise = this.launchBrowser();
    }

    return this.launchPromise;
  }

  /**
   * Internal method that performs the actual browser launch.
   * Only called once per toolset lifecycle (unless launch fails).
   */
  private async launchBrowser(): Promise<BrowserManagerLike> {
    const { BrowserManager: BrowserManagerClass } = await import('agent-browser/dist/browser.js');
    const manager = new BrowserManagerClass();
    try {
      await manager.launch({
        id: 'browser-toolset-launch',
        action: 'launch',
        headless: this.config.headless,
      });
      // Store the successfully launched browser
      this.browserManager = manager;

      // Notify all registered callbacks that browser is ready
      for (const callback of this.onBrowserReadyCallbacks) {
        try {
          callback();
        } catch (error) {
          console.warn('[Browser] onBrowserReady callback error:', error);
        }
      }

      return manager;
    } catch (error) {
      // Reset promise to allow retry on next call
      this.launchPromise = null;
      // Clean up partial state
      try {
        await manager.close();
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Check if the browser is currently running.
   * Does NOT launch the browser - just checks current state.
   */
  isBrowserRunning(): boolean {
    return this.browserManager !== null;
  }

  /**
   * Get the current page URL without launching the browser.
   *
   * @returns The current URL string, or null if browser is not running
   */
  getCurrentUrl(): string | null {
    if (!this.browserManager) {
      return null;
    }
    try {
      return this.browserManager.getPage().url();
    } catch {
      return null;
    }
  }

  /**
   * Register a callback to be invoked when the browser launches.
   * If browser is already running, callback is invoked immediately.
   *
   * @param callback - Function to call when browser becomes ready
   * @returns Cleanup function to unregister the callback
   */
  onBrowserReady(callback: () => void): () => void {
    // If browser is already running, invoke immediately
    if (this.browserManager) {
      callback();
    }

    // Register for future launches (e.g., after close and relaunch)
    this.onBrowserReadyCallbacks.add(callback);

    // Return cleanup function
    return () => {
      this.onBrowserReadyCallbacks.delete(callback);
    };
  }

  /**
   * Start screencast only if browser is already running.
   * Does NOT launch the browser - returns null if browser not running.
   */
  async startScreencastIfBrowserActive(options?: ScreencastOptions): Promise<ScreencastStream | null> {
    if (!this.browserManager) {
      return null;
    }
    const stream = new ScreencastStream(this.browserManager, options);
    await stream.start();
    return stream;
  }

  /**
   * Closes the browser and releases resources.
   * Should be called when the toolset is no longer needed.
   * Safe to call multiple times - subsequent calls are no-ops.
   */
  async close(): Promise<void> {
    // Clear the launch promise to allow fresh launch after close
    this.launchPromise = null;

    if (this.browserManager) {
      try {
        await this.browserManager.close();
      } catch (error) {
        // Log but don't throw - cleanup should be best-effort
        console.warn('[Browser] Error closing browser:', error);
      } finally {
        this.browserManager = null;
      }
    }
  }

  /**
   * Start screencast streaming. Returns a stream object with event emitter interface.
   * If browser not yet launched, waits for launch before starting.
   */
  async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    const browser = await this.getBrowser();
    const stream = new ScreencastStream(browser, options);
    await stream.start();
    return stream;
  }

  /**
   * Inject a mouse event via CDP passthrough.
   * Waits for browser to be ready if not launched.
   */
  async injectMouseEvent(event: {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
    x: number;
    y: number;
    button?: 'left' | 'right' | 'middle' | 'none';
    clickCount?: number;
    deltaX?: number;
    deltaY?: number;
    modifiers?: number;
  }): Promise<void> {
    const browser = await this.getBrowser();
    await browser.injectMouseEvent(event);
  }

  /**
   * Inject a keyboard event via CDP passthrough.
   * Waits for browser to be ready if not launched.
   */
  async injectKeyboardEvent(event: {
    type: 'keyDown' | 'keyUp' | 'char';
    key?: string;
    code?: string;
    text?: string;
    modifiers?: number;
  }): Promise<void> {
    const browser = await this.getBrowser();
    await browser.injectKeyboardEvent(event);
  }
}
