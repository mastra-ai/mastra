/**
 * @mastra/browser-use
 *
 * Browser automation using Browser Use cloud service.
 * Uses the official browser-use-sdk for cloud browser sessions
 * with raw CDP for screencast, input injection, and navigation.
 */

// Main browser class
export { BrowserUseBrowser } from './browser-use-browser';

// Thread manager
export { BrowserUseThreadManager } from './thread-manager';
export type { BrowserUseThreadManagerConfig } from './thread-manager';

// Tools
export { createBrowserUseTools, BROWSER_USE_TOOLS } from './tools';
export type { BrowserUseToolName } from './tools';

// Schemas
export * from './schemas';

// Types
export type { BrowserConfig, BrowserSessionInfo, BrowserScope } from './types';
