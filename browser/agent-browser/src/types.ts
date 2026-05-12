import type { BrowserConfig as BaseBrowserConfig } from '@mastra/core/browser';
import type { BrowserToolName } from './tools/constants';

/**
 * AgentBrowser-specific configuration extensions.
 */
export interface AgentBrowserConfigExtensions {
  /**
   * Path to a Playwright storage state file (JSON) containing cookies and localStorage.
   * This is a lighter-weight alternative to `profile` — it only persists
   * authentication state, not the full browser profile.
   *
   * You can export storage state from a Playwright session and reuse it later.
   *
   * @example
   * ```ts
   * { storageState: './auth-state.json' }
   * ```
   */
  storageState?: string;

  /**
   * Tool names to exclude from the browser toolset.
   * Use this to disable specific tools, e.g. `['browser_screenshot']`
   * to skip the screenshot tool for models that don't support vision.
   *
   * @example
   * ```ts
   * new AgentBrowser({ excludeTools: ['browser_screenshot'] })
   * ```
   */
  excludeTools?: BrowserToolName[];
}

/**
 * Configuration options for AgentBrowser.
 * Extends the base BrowserConfig with agent-browser specific options.
 */
export type BrowserConfig = BaseBrowserConfig & AgentBrowserConfigExtensions;
