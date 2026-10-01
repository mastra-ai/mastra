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
   * Alpha: configure WebMCP tool discovery and invocation.
   *
   * WebMCP is enabled by default. AgentBrowser injects an in-page bridge
   * that captures tools exposed by the current page and adds a
   * `browser_webmcp` tool for the agent. To turn it off, pass
   * `{ enabled: false }`.
   *
   * @example
   * ```ts
   * // Default: enabled, listening for every supported protocol
   * new AgentBrowser()
   *
   * // Only the W3C navigator.modelContext draft
   * new AgentBrowser({ webmcp: { protocols: ['w3c'] } })
   *
   * // Lock down to specific origins
   * new AgentBrowser({ webmcp: { allowedOrigins: ['https://shop.example.com'] } })
   *
   * // Opt out
   * new AgentBrowser({ webmcp: { enabled: false } })
   * ```
   */
  webmcp?: WebmcpOptions;
}

/**
 * A WebMCP protocol the in-page bridge can listen for.
 *
 * - `mcpb`: pages that run an in-page MCP server over the `@mcp-b/transports`
 *   Tab transport (`McpServer` + `TabServerTransport`). The bridge connects as
 *   a real MCP client over `window.postMessage`.
 * - `w3c`: the W3C `navigator.modelContext` draft. The bridge provides a
 *   polyfill and mirrors registrations into a native implementation when one
 *   exists. Pages built on `@mcp-b/webmcp-polyfill` register through this
 *   same API.
 */
export type WebmcpProtocol = 'mcpb' | 'w3c';

/**
 * Alpha configuration for WebMCP tool discovery.
 */
export interface WebmcpOptions {
  /**
   * Turn WebMCP support off entirely. When `false`, no in-page bridge is
   * injected and the `browser_webmcp` tool is not added to the agent.
   * Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Which WebMCP protocols to listen for. When omitted (or empty), all
   * supported protocols are enabled and auto-detected per page. W3C
   * registrations win when a page exposes the same tool name under both
   * surfaces.
   */
  protocols?: WebmcpProtocol[];
  /**
   * Restrict which page origins can expose callable WebMCP tools to the agent.
   *
   * When omitted, tools from any origin are allowed. When provided, only
   * pages whose current URL has an exact origin match (scheme + host + port)
   * can list or call tools. `file://` pages must be listed as `file://` and
   * `about:blank` is never callable.
   */
  allowedOrigins?: string[];
}

/**
 * Configuration options for AgentBrowser.
 * Extends the base BrowserConfig with agent-browser specific options.
 */
export type BrowserConfig = BaseBrowserConfig & AgentBrowserConfigExtensions;
