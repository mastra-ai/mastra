import type { AgentBrowserConfig } from '@mastra/agent-browser';

/**
 * Options passed to Firecrawl `POST /v2/browser` (see Firecrawl JS SDK `browser()`).
 */
export interface FirecrawlBrowserSessionOptions {
  ttl?: number;
  activityTtl?: number;
  streamWebView?: boolean;
  profile?: {
    name: string;
    saveChanges?: boolean;
  };
  integration?: string;
  origin?: string;
}

/** Configuration for {@link FirecrawlBrowser}. */
export type FirecrawlBrowserConfig = AgentBrowserConfig & {
  /** Firecrawl API key (or set `FIRECRAWL_API_KEY` in the environment and omit). */
  apiKey?: string;
  /** Base URL for a self-hosted Firecrawl API. */
  apiUrl?: string;
  /** Per-session options for Firecrawl Browser Sandbox. */
  firecrawl?: FirecrawlBrowserSessionOptions;
};
