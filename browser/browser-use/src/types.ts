import type { BrowserConfig as BaseBrowserConfig, ThreadIsolationMode } from '@mastra/core/browser';

export type { ThreadIsolationMode };

/**
 * Configuration options for BrowserUseBrowser.
 * Extends the base BrowserConfig with browser-use SDK specific options.
 *
 * Note: `headless` and `cdpUrl` are omitted - Browser Use SDK is cloud-only
 * and provides its own CDP URL from the session.
 */
export interface BrowserConfig extends Omit<BaseBrowserConfig, 'headless' | 'cdpUrl'> {
  /**
   * Browser Use API key.
   * If not provided, will use BROWSER_USE_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Profile ID for browser session persistence.
   * Sessions with the same profile ID share cookies/storage.
   */
  profileId?: string;

  /**
   * Proxy country code (e.g., 'us', 'uk').
   * Set to null to disable proxy.
   * @default 'us'
   */
  proxyCountryCode?: string | null;

  /**
   * Session timeout in minutes.
   * @default 60
   */
  sessionTimeout?: number;

  /**
   * Browser screen dimensions.
   */
  viewport?: {
    width?: number;
    height?: number;
  };

  /**
   * Whether to enable session recording.
   * @default false
   */
  enableRecording?: boolean;
}

/**
 * Browser session info from the SDK.
 */
export interface BrowserSessionInfo {
  /** Session ID */
  id: string;
  /** CDP WebSocket URL for browser control */
  cdpUrl: string | null;
  /** Live view URL */
  liveUrl: string | null;
  /** Session status */
  status: 'active' | 'stopped';
  /** When session will timeout */
  timeoutAt: string;
}
