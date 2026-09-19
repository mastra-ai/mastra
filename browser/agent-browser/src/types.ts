import type { BrowserConfig as BaseBrowserConfig, BrowserRecordingOptions } from '@mastra/core/browser';
import type { SavedBrowserTabsOptions } from './saved-tabs';
import type { BrowserToolName } from './tools/constants';

/**
 * AgentBrowser-specific configuration extensions.
 */
export interface AgentBrowserConfigExtensions {
  /** Restore saved page URLs when a shared browser is relaunched. Does not restore forms or authentication. */
  restoreTabsOnLaunch?: boolean;
  /** Observe trusted page input from other CDP clients, including remote viewers. Chromium only. */
  observeUserActivity?: boolean;
  /** Close after this much idle time. Requires observeUserActivity; long browser operations remain protected. */
  idleTimeoutMs?: number;
  /** Persist saved web page URLs in the existing native thread for restoration after restart. */
  savedTabs?: SavedBrowserTabsOptions;
  /**
   * Headers passed to chromium.connectOverCDP when using `cdpUrl`.
   * Required for providers like Cloudflare Browser Rendering (Authorization bearer token).
   * Distinct from page `extraHTTPHeaders` / navigation headers.
   */
  cdpHeaders?: Record<string, string>;
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
   * Alpha: opt into browser recording tools.
   *
   * Recording tools are disabled by default. Provide an output directory to add
   * `browser_record` and `browser_record_caption` to this browser's toolset.
   */
  recording?: BrowserRecordingOptions;

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
