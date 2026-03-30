/**
 * Browser Use Tools
 *
 * Creates browser automation tools bound to a BrowserUseBrowser instance.
 * The primary tool is `browser_use_run` which delegates tasks to Browser Use's cloud AI agent.
 */

import type { Tool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { createCloseTool } from './close';
import { BROWSER_USE_TOOLS } from './constants';
import { createGetUrlTool } from './get-url';
import { createNavigateTool } from './navigate';
import { createRunTool } from './run';
import { createScreenshotTool } from './screenshot';
import { createSessionInfoTool } from './session-info';

export { BROWSER_USE_TOOLS, type BrowserUseToolName } from './constants';

/**
 * Creates all Browser Use tools bound to a BrowserUseBrowser instance.
 * The browser is lazily initialized on first tool use.
 */
export function createBrowserUseTools(browser: BrowserUseBrowser): Record<string, Tool<any, any>> {
  return {
    // Core AI
    [BROWSER_USE_TOOLS.RUN]: createRunTool(browser),
    // Navigation & State
    [BROWSER_USE_TOOLS.NAVIGATE]: createNavigateTool(browser),
    [BROWSER_USE_TOOLS.SCREENSHOT]: createScreenshotTool(browser),
    [BROWSER_USE_TOOLS.GET_URL]: createGetUrlTool(browser),
    [BROWSER_USE_TOOLS.SESSION_INFO]: createSessionInfoTool(browser),
    [BROWSER_USE_TOOLS.CLOSE]: createCloseTool(browser),
  };
}
