import type { BrowserConfig as BaseBrowserConfig } from '@mastra/core/browser';

/**
 * Configuration options for AgentBrowser.
 * Currently re-exports BaseBrowserConfig for API consistency.
 * Agent-browser specific options can be added here in the future.
 */
export type BrowserConfig = BaseBrowserConfig;
