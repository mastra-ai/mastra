import type { BrowserConfig as BaseBrowserConfig } from '@mastra/core/browser';

/**
 * Configuration options for AgentBrowser.
 * Extends the base BrowserConfig with agent-browser specific options.
 */
export interface BrowserConfig extends BaseBrowserConfig {
  /**
   * Allow file:// URLs to be loaded.
   * @default false
   */
  allowFileAccess?: boolean;

  /**
   * Automatically connect to cdpUrl on first tool use.
   * Only relevant when cdpUrl is provided.
   * @default true
   */
  autoConnect?: boolean;
}
