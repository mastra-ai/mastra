/**
 * Stagehand Browser Types
 */

import type { BrowserConfigBase, BrowserScope, CdpUrlProvider } from '@mastra/core/browser';

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
 * Stagehand-specific configuration fields.
 */
interface StagehandConfigExtensions {
  /**
   * Environment to run the browser in
   * - 'LOCAL': Run browser locally
   * - 'BROWSERBASE': Use Browserbase cloud
   * @default 'LOCAL'
   */
  env?: 'LOCAL' | 'BROWSERBASE';

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
   * Enable self-healing selectors.
   * When enabled, Stagehand uses AI to find elements even when selectors fail.
   * @default true
   */
  selfHeal?: boolean;

  /**
   * Timeout for DOM to settle after actions (ms)
   * @default 5000
   */
  domSettleTimeout?: number;

  /**
   * Logging verbosity level
   * - 0: Silent
   * - 1: Errors only
   * - 2: Verbose
   * @default 1
   */
  verbose?: 0 | 1 | 2;

  /**
   * Custom system prompt for AI operations (act, extract, observe)
   */
  systemPrompt?: string;
}

/**
 * Configuration for StagehandBrowser with compile-time enforcement of cdpUrl/scope compatibility.
 *
 * This type enforces that `cdpUrl` and `scope: 'thread'` cannot be used together:
 * - When `cdpUrl` is provided, `scope` must be `'shared'` or omitted
 * - When `scope: 'thread'` is used, `cdpUrl` must not be provided
 */
export type StagehandBrowserConfig =
  | (BrowserConfigBase & StagehandConfigExtensions & { cdpUrl?: undefined; scope?: BrowserScope })
  | (BrowserConfigBase & StagehandConfigExtensions & { cdpUrl: CdpUrlProvider; scope?: 'shared' });

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
  url?: string;
  hint?: string;
}

/**
 * Result from extract()
 */
export interface ExtractResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  url?: string;
  hint?: string;
}

/**
 * Result from observe()
 */
export interface ObserveResult {
  success: boolean;
  actions: StagehandAction[];
  url?: string;
  hint?: string;
}
