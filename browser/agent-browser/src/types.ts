/**
 * CDP URL provider - can be a string or a function that returns a string/promise.
 * This allows dynamic CDP URL resolution from cloud providers like Browserbase, Browserless, etc.
 *
 * @example
 * // Static URL
 * cdpUrl: 'ws://localhost:9222'
 *
 * @example
 * // Dynamic URL from Browserbase
 * cdpUrl: async () => {
 *   const session = await browserbase.createSession();
 *   return session.connectUrl;
 * }
 */
export type CdpUrlProvider = string | (() => string | Promise<string>);

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
   * Can be a string or a function that returns the URL (for dynamic resolution).
   *
   * @example
   * // Static URL
   * cdpUrl: 'ws://localhost:9222'
   *
   * @example
   * // Dynamic URL from cloud provider
   * cdpUrl: async () => {
   *   const session = await provider.createSession();
   *   return session.connectUrl;
   * }
   */
  cdpUrl?: CdpUrlProvider;

  /**
   * Automatically connect to cdpUrl on first tool use.
   * Only relevant when cdpUrl is provided.
   * @default true
   */
  autoConnect?: boolean;
}
