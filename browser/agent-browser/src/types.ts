import type { BaseBrowserConfig } from '@mastra/core/browser';

/**
 * Configuration options for the Browser (agent-browser provider).
 *
 * Extends the base browser config shared by all providers.
 */
export interface BrowserConfig extends BaseBrowserConfig {
  /**
   * Allow file:// URLs to be loaded.
   * @default false
   */
  allowFileAccess?: boolean;

  /**
   * CDP WebSocket URL to connect to an existing browser.
   * If provided, will connect instead of launching a new browser.
   */
  cdpUrl?: string;

  /**
   * Automatically connect to cdpUrl on first tool use.
   * Only relevant when cdpUrl is provided.
   * @default true
   */
  autoConnect?: boolean;
}
