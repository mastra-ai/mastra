/**
 * Types for @mastra/browser-viewer
 */

import type { BrowserConfigBase } from '@mastra/core/browser';

/**
 * Supported CLI providers that can be used with BrowserViewer.
 */
export type CLIProvider = 'agent-browser' | 'browser-use' | 'browse-cli';

/**
 * Configuration for BrowserViewer.
 */
export interface BrowserViewerConfig extends BrowserConfigBase {
  /**
   * Which CLI the agent will use for browser automation.
   * The CLI connects to Mastra's Chrome via the CDP URL.
   */
  cli: CLIProvider;

  /**
   * Port for Chrome's remote debugging protocol.
   * Only used when launching Chrome (not when connecting via cdpUrl).
   *
   * @default 0 (auto-assign available port)
   */
  cdpPort?: number;
}
