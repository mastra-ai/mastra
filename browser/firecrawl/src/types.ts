import type { AgentBrowserConfig } from '@mastra/agent-browser';

/**
 * Options passed to Firecrawl `POST /v2/browser` (see Firecrawl JS SDK `browser()`).
 *
 * **Note:** {@link AgentBrowserConfig.profile} is the Playwright / agent-browser user-data directory
 * (filesystem path). The optional `profile` below is Firecrawl’s **named sandbox profile** for the
 * hosted browser API only—different meaning, same nested key name as required by the SDK.
 */
export interface FirecrawlBrowserSessionOptions {
  /** Max session wall-clock lifetime (seconds, Firecrawl API). */
  ttl?: number;
  /** Idle timeout before the sandbox recycles the session (seconds, Firecrawl API). */
  activityTtl?: number;
  /** When true, Firecrawl may stream WebView frames for the remote session. */
  streamWebView?: boolean;
  /** Firecrawl named profile (not the same as top-level `AgentBrowserConfig.profile`). */
  profile?: {
    /** Saved profile name in Firecrawl. */
    name: string;
    /** Persist profile changes when the session ends. */
    saveChanges?: boolean;
  };
  /** Optional integration label for Firecrawl analytics / routing. */
  integration?: string;
  /** Optional origin hint for the Firecrawl browser session. */
  origin?: string;
}

/** Configuration for {@link FirecrawlBrowser}. */
export type FirecrawlBrowserConfig = AgentBrowserConfig & {
  /** Firecrawl API key (or set `FIRECRAWL_API_KEY` in the environment and omit). */
  apiKey?: string;
  /** Base URL for a self-hosted Firecrawl API. */
  apiUrl?: string;
  /**
   * Firecrawl-only session options (`browser()`). Distinct from {@link AgentBrowserConfig.profile}
   * (local Playwright profile path): see {@link FirecrawlBrowserSessionOptions.profile}.
   */
  firecrawl?: FirecrawlBrowserSessionOptions;
};
