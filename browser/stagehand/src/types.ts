/**
 * Stagehand Browser Types
 */

import type { ModelConfiguration as StagehandModelConfiguration } from '@browserbasehq/stagehand';
import type { BrowserConfig as BaseBrowserConfig, BrowserRecordingOptions } from '@mastra/core/browser';
import type { StagehandToolName } from './tools/constants';

/**
 * Model configuration for Stagehand AI operations.
 */
export type ModelConfiguration = StagehandModelConfiguration;

/**
 * Stagehand-specific configuration fields.
 */
export interface StagehandLogLine {
  category?: string;
  message: string;
  level?: 0 | 1 | 2;
  timestamp?: string;
  auxiliary?: Record<string, { value: string; type: string }>;
}

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
   * Enable Stagehand experimental features.
   */
  experimental?: boolean;

  /**
   * Disable the Stagehand API so model execution runs locally.
   */
  disableAPI?: boolean;

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
   * Logging verbosity level.
   * - 0: Suppress INFO/DEBUG logs
   * - 1: Include INFO logs
   * - 2: Include DEBUG logs
   *
   * @default 0
   */
  verbose?: 0 | 1 | 2;

  /**
   * Optional Stagehand logger hook. When provided, Stagehand log lines are
   * routed here instead of being written directly to the process console.
   */
  logger?: (line: StagehandLogLine) => void;

  /**
   * Disable Stagehand's Pino console logging backend.
   *
   * @default true
   */
  disablePino?: boolean;

  /**
   * Custom system prompt for AI operations (act, extract, observe)
   */
  systemPrompt?: string;

  /**
   * Whether to preserve the user data directory after the browser closes.
   * By default, Stagehand may clean up temporary user data directories.
   * Set to `true` to keep the profile data for future sessions.
   *
   * Only applicable when `profile` is provided.
   *
   * @default false
   */
  preserveUserDataDir?: boolean;

  /**
   * Alpha: opt into browser recording tools.
   *
   * Recording tools are disabled by default. Provide an output directory to add
   * `browser_record` and `browser_record_caption` to this browser's toolset.
   */
  recording?: BrowserRecordingOptions;

  /**
   * Tool names to exclude from the browser toolset.
   * Use this to disable specific tools, e.g. `['stagehand_screenshot']`
   * to skip the screenshot tool for models that don't support vision.
   *
   * @example
   * ```ts
   * new StagehandBrowser({ excludeTools: ['stagehand_screenshot'] })
   * ```
   */
  excludeTools?: StagehandToolName[];
}

/**
 * Configuration for StagehandBrowser.
 * Extends the base BrowserConfig with Stagehand-specific options.
 */
export type StagehandBrowserConfig = BaseBrowserConfig & StagehandConfigExtensions;

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
