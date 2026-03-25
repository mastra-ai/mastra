/**
 * Workspace Types
 *
 * Shared types for the workspace module.
 */

import type { CdpUrlProvider, ScreencastOptions, CLIProvider } from '../browser';
import type { RequestContext } from '../request-context';

// =============================================================================
// Browser Capabilities
// =============================================================================

/**
 * Browser capabilities configuration for Workspace.
 *
 * When configured, enables:
 * - Screencast streaming via CDP
 * - Browser context injection (current URL in prompts)
 * - Input injection for interactive viewing
 *
 * The agent uses workspace_execute_command + CLI skills for automation.
 * This config only handles the "viewing" side.
 *
 * The CLI provider handles browser launch/lifecycle. BrowserViewer connects
 * to it for observation (screencast, URL/title).
 */
export interface BrowserCapabilities {
  /**
   * CLI provider for browser automation.
   *
   * The agent uses this CLI via workspace_execute_command to automate the browser.
   * BrowserViewer gets the CDP URL from this CLI for screencast/context.
   *
   * For built-in providers (`agent-browser`, `playwright-cli`, `browser-use`),
   * the corresponding skill is automatically installed when `workspace.init()`
   * or `workspace.getBrowserViewer()` is called.
   *
   * @example Built-in provider
   * ```typescript
   * const workspace = new Workspace({
   *   sandbox: new LocalSandbox(),
   *   browser: { cli: 'agent-browser' },
   * });
   * await workspace.init(); // Auto-installs agent-browser skill
   * ```
   *
   * @example Custom provider
   * ```typescript
   * browser: {
   *   cli: {
   *     getCdpUrlCommand: 'my-browser get cdp-url',
   *     checkCommand: 'my-browser --version',
   *     installCommand: 'npm install -g my-browser',
   *   }
   * }
   * ```
   */
  cli?: CLIProvider;

  /**
   * Direct CDP WebSocket URL or function that returns one.
   * Used for screencast and context injection.
   * Takes precedence over CLI if both are provided.
   *
   * @example Static URL
   * ```typescript
   * cdpUrl: 'ws://localhost:9222/devtools/browser/...'
   * ```
   *
   * @example Dynamic URL (from cloud provider)
   * ```typescript
   * cdpUrl: async () => {
   *   const session = await browserbase.createSession();
   *   return session.cdpUrl;
   * }
   * ```
   */
  cdpUrl?: CdpUrlProvider;

  /**
   * Cloud browser provider.
   * When set, the workspace will fetch the CDP URL from the provider's API.
   *
   * Requires `apiKey` for the provider.
   */
  provider?: 'browserbase' | 'kernel' | 'browser-use-cloud';

  /** API key for cloud provider */
  apiKey?: string;

  /** Project ID for Browserbase */
  projectId?: string;

  /** Screencast options */
  screencast?: ScreencastOptions;

  /** Auto-connect to browser on workspace init (default: false) */
  autoConnect?: boolean;
}

// =============================================================================
// Workspace Status
// =============================================================================

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';

/**
 * Instructions configuration for workspace providers.
 *
 * - `string` — Fully replaces the default instructions.
 * - `(opts) => string` — Receives the default instructions and optional
 *   request context, allowing the caller to extend or customise per-request.
 *
 * @example Static override
 * ```typescript
 * new LocalFilesystem({
 *   basePath: './data',
 *   instructions: 'Custom instructions for this filesystem.',
 * });
 * ```
 *
 * @example Function form (extend auto-generated)
 * ```typescript
 * new LocalFilesystem({
 *   basePath: './data',
 *   instructions: ({ defaultInstructions, requestContext }) => {
 *     const locale = requestContext?.get('locale') ?? 'en';
 *     return `${defaultInstructions}\nUser locale: ${locale}`;
 *   },
 * });
 * ```
 */
export type InstructionsOption =
  | string
  | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);
