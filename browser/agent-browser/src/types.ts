/**
 * Configuration options for AgentBrowser.
 */
export interface BrowserConfig {
  /**
   * Run browser in headless mode.
   * @default true
   */
  headless?: boolean;

  /**
   * Default timeout in milliseconds for browser operations.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

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
