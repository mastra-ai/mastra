/**
 * Browser Types
 *
 * This file contains legacy types that were used for low-level browser operations.
 * With the new architecture, providers implement MastraBrowser and handle low-level
 * details internally.
 *
 * These types are kept for backwards compatibility but may be removed in a future release.
 */

/**
 * Base configuration shared by all browser providers.
 *
 * Provider packages extend this with their own options
 * (e.g., Browserbase adds `apiKey`, `projectId`).
 *
 * @deprecated Use BrowserConfig from MastraBrowser instead
 */
export interface BaseBrowserConfig {
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
}
