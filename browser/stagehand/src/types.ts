/**
 * Stagehand Browser Types
 */

import type { BrowserConfig } from '@mastra/core/browser';

/**
 * Model configuration for Stagehand AI operations
 */
export type ModelConfiguration =
  | string // Format: "provider/model" (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022")
  | {
      modelName: string;
      apiKey?: string;
      baseURL?: string;
    };

/**
 * CDP URL provider - can be a string or a function that returns a string/promise
 * This allows dynamic CDP URL resolution from cloud providers like Browserbase, Browserless, etc.
 */
export type CdpUrlProvider = string | (() => string | Promise<string>);

/**
 * Configuration for StagehandBrowser
 */
export interface StagehandBrowserConfig extends BrowserConfig {
  /**
   * Environment to run the browser in
   * - 'LOCAL': Run browser locally
   * - 'BROWSERBASE': Use Browserbase cloud
   * @default 'LOCAL'
   */
  env?: 'LOCAL' | 'BROWSERBASE';

  /**
   * CDP URL for connecting to a remote browser.
   * Can be a string or a function that returns the URL (for dynamic resolution).
   */
  cdpUrl?: CdpUrlProvider;

  /**
   * Browserbase API key (required when env = 'BROWSERBASE')
   */
  apiKey?: string;

  /**
   * Browserbase project ID (required when env = 'BROWSERBASE')
   */
  projectId?: string;

  /**
   * Model configuration for AI operations
   * @default 'openai/gpt-4o'
   */
  model?: ModelConfiguration;

  /**
   * Enable self-healing selectors
   * @default true
   */
  selfHeal?: boolean;

  /**
   * Enable experimental features
   * @default false
   */
  experimental?: boolean;

  /**
   * Timeout for DOM to settle after actions (ms)
   * @default 5000
   */
  domSettleTimeout?: number;

  /**
   * Directory for caching action observations
   */
  cacheDir?: string;

  /**
   * Logging verbosity level
   * - 0: Silent
   * - 1: Errors only
   * - 2: Verbose
   * @default 1
   */
  verbose?: 0 | 1 | 2;

  /**
   * Custom system prompt for AI operations
   */
  systemPrompt?: string;
}

/**
 * Action returned from observe()
 */
export interface StagehandAction {
  /** XPath selector to locate element */
  selector: string;
  /** Human-readable description */
  description: string;
  /** Suggested action method */
  method?: string;
  /** Additional action parameters */
  arguments?: string[];
}

/**
 * Result from act()
 */
export interface ActResult {
  success: boolean;
  message?: string;
  action?: string;
}

/**
 * Result from extract()
 */
export interface ExtractResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Result from observe()
 */
export interface ObserveResult {
  success: boolean;
  actions: StagehandAction[];
}
