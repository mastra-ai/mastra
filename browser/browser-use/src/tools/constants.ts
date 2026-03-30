/**
 * Browser Use Tool Constants
 */

export const BROWSER_USE_TOOLS = {
  // Core AI
  RUN: 'browser_use_run',
  // Navigation & State
  NAVIGATE: 'browser_use_navigate',
  SCREENSHOT: 'browser_use_screenshot',
  GET_URL: 'browser_use_get_url',
  SESSION_INFO: 'browser_use_session_info',
  CLOSE: 'browser_use_close',
} as const;

export type BrowserUseToolName = (typeof BROWSER_USE_TOOLS)[keyof typeof BROWSER_USE_TOOLS];
