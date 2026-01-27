import { BrowserManager } from 'agent-browser/dist/browser.js';
import type { ToolAction } from '@mastra/core/tools';

import { createClickTool } from './tools/click.js';
import { createNavigateTool } from './tools/navigate.js';
import { createScreenshotTool } from './tools/screenshot.js';
import { createScrollTool } from './tools/scroll.js';
import { createSelectTool } from './tools/select.js';
import { createSnapshotTool } from './tools/snapshot.js';
import { createTypeTool } from './tools/type.js';
import type { BrowserToolsetConfig } from './types.js';

/**
 * BrowserToolset provides browser automation tools for Mastra agents.
 *
 * The browser is initialized lazily on first tool use, not at construction time.
 * This allows you to create the toolset without incurring browser startup costs
 * until the agent actually needs to use browser functionality.
 *
 * @example
 * ```typescript
 * const browserTools = new BrowserToolset({ headless: true });
 *
 * const agent = new Agent({
 *   tools: browserTools.tools,
 * });
 *
 * // Browser launches lazily on first tool use
 * await agent.generate('Navigate to https://example.com');
 *
 * // Always close when done to release resources
 * await browserTools.close();
 * ```
 */
export class BrowserToolset {
  /** Identifier for this toolset */
  readonly name = 'agent-browser';

  /** Internal BrowserManager instance, lazily initialized */
  private browserManager: BrowserManager | null = null;

  /** Promise for in-progress browser launch - prevents concurrent launches */
  private launchPromise: Promise<BrowserManager> | null = null;

  /** Resolved configuration with defaults */
  private config: Required<BrowserToolsetConfig>;

  /** Tools exposed by this toolset */
  readonly tools: Record<string, ToolAction<any, any>>;

  /**
   * Creates a new BrowserToolset instance.
   *
   * @param config - Optional configuration for browser behavior
   * @param config.headless - Run browser without visible UI (default: true)
   * @param config.timeout - Default timeout for browser operations in ms (default: 10000)
   */
  constructor(config: BrowserToolsetConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 10_000, // 10 seconds
    };

    // Initialize tools with getBrowser closure for lazy initialization
    this.tools = {
      browser_navigate: createNavigateTool(() => this.getBrowser(), this.config.timeout),
      browser_snapshot: createSnapshotTool(() => this.getBrowser()),
      browser_click: createClickTool(() => this.getBrowser(), this.config.timeout),
      browser_type: createTypeTool(() => this.getBrowser(), this.config.timeout),
      browser_select: createSelectTool(() => this.getBrowser(), this.config.timeout),
      browser_scroll: createScrollTool(() => this.getBrowser()),
      browser_screenshot: createScreenshotTool(() => this.getBrowser(), 30_000), // 30s timeout for screenshots
    };
  }

  /**
   * Lazily initializes and returns the browser instance.
   * Uses Singleton Promise pattern to prevent concurrent launches.
   *
   * @returns Promise resolving to the BrowserManager instance
   */
  private async getBrowser(): Promise<BrowserManager> {
    // Fast path: already initialized
    if (this.browserManager) {
      return this.browserManager;
    }

    // Start launch if not in progress
    // CRITICAL: This assignment is synchronous - no await between check and assign
    if (!this.launchPromise) {
      this.launchPromise = this.launchBrowser();
    }

    // All concurrent callers share this same promise
    return this.launchPromise;
  }

  /**
   * Internal method that performs the actual browser launch.
   * Only called once per toolset lifecycle (unless launch fails).
   *
   * @returns Promise resolving to the BrowserManager instance
   */
  private async launchBrowser(): Promise<BrowserManager> {
    const manager = new BrowserManager();
    try {
      await manager.launch({
        id: 'browser-toolset-launch',
        action: 'launch',
        headless: this.config.headless,
      });
      // Store the successfully launched browser
      this.browserManager = manager;
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
   * Closes the browser and releases resources.
   * Should be called when the toolset is no longer needed.
   * Safe to call multiple times - subsequent calls are no-ops.
   *
   * @example
   * ```typescript
   * const browserTools = new BrowserToolset();
   * try {
   *   // Use tools...
   * } finally {
   *   await browserTools.close();
   * }
   * ```
   */
  async close(): Promise<void> {
    if (this.browserManager) {
      try {
        await this.browserManager.close();
      } catch (error) {
        // Log but don't throw - cleanup should be best-effort
        console.warn('[BrowserToolset] Error closing browser:', error);
      } finally {
        this.browserManager = null;
      }
    }
  }
}
