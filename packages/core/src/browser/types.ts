/**
 * Base configuration shared by all browser providers.
 *
 * Provider packages extend this with their own options
 * (e.g., Browserbase adds `apiKey`, `projectId`).
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
