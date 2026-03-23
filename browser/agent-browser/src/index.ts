// Main exports
export { AgentBrowser } from './agent-browser.js';

// Type exports
export type { BrowserConfig } from './types.js';
export type {
  BrowserLocator,
  BrowserPage,
  BrowserKeyboard,
  BrowserContext,
  BrowserCookie,
  BrowserManagerLike,
  ScreencastFrame,
  BrowserTab,
  EnhancedSnapshot,
} from './browser-types.js';

// Screencast exports
export { ScreencastStream, SCREENCAST_DEFAULTS, MAX_RETRIES } from './screencast/index.js';
export type { ScreencastOptions, ScreencastFrameData, ScreencastError, ScreencastEvents } from './screencast/index.js';
