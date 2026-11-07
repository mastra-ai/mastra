import type { BrowserConfig as BaseBrowserConfig, BrowserRecordingOptions } from '@mastra/core/browser';
import type { BrowserToolName } from './tools/constants';

/**
 * AgentBrowser-specific configuration extensions.
 */
export interface AgentBrowserConfigExtensions {
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

  /**
   * Keep the browser off the machine it runs on and off private networks.
   * Use this when agents browse from a server that holds secrets or sits next
   * to internal services.
   *
   * Blocks `file:` URLs, localhost, private and link-local addresses (including
   * cloud metadata at `169.254.169.254`), whether the page opens them directly,
   * through a redirect, from a service worker or WebSocket, or through a
   * hostname whose DNS points at one of them. Public sites work as usual.
   *
   * Pass `{ allow }` to let specific private hosts through, as `host` or
   * `host:port` (for example `localhost:3000`).
   *
   * Only browsers AgentBrowser launches itself can be protected, so this can't
   * be combined with `cdpUrl` or `createThreadManager`.
   *
   * @default false
   *
   * @example
   * ```ts
   * new AgentBrowser({ blockPrivateNetwork: true })
   * new AgentBrowser({ blockPrivateNetwork: { allow: ['localhost:3000'] } })
   * ```
   */
  blockPrivateNetwork?: boolean | { allow: string[] };
}

/**
 * Configuration options for AgentBrowser.
 * Extends the base BrowserConfig with agent-browser specific options.
 */
export type BrowserConfig = BaseBrowserConfig & AgentBrowserConfigExtensions;
