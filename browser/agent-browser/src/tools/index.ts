/**
 * AgentBrowser Tools
 *
 * Creates browser tools bound to an AgentBrowser instance.
 * Each tool is defined in its own file for maintainability.
 */

import type { Tool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { createBackTool } from './back';
import { createClickTool } from './click';
import { createCloseTool } from './close';
import { BROWSER_TOOLS } from './constants';
import { createDialogTool } from './dialog';
import { createDragTool } from './drag';
import { createEvaluateTool } from './evaluate';
import { createGotoTool } from './goto';
import { createHoverTool } from './hover';
import { createPressTool } from './press';
import { createScrollTool } from './scroll';
import { createSelectTool } from './select';
import { createSnapshotTool } from './snapshot';
import { createTabsTool } from './tabs';
import { createTypeTool } from './type';
import { createWaitTool } from './wait';

export { BROWSER_TOOLS, type BrowserToolName } from './constants';

/**
 * Creates all browser tools bound to an AgentBrowser instance.
 * The browser is lazily initialized on first tool use.
 */
export function createAgentBrowserTools(browser: AgentBrowser): Record<string, Tool<any, any>> {
  return {
    // Core (9)
    [BROWSER_TOOLS.GOTO]: createGotoTool(browser),
    [BROWSER_TOOLS.SNAPSHOT]: createSnapshotTool(browser),
    [BROWSER_TOOLS.CLICK]: createClickTool(browser),
    [BROWSER_TOOLS.TYPE]: createTypeTool(browser),
    [BROWSER_TOOLS.PRESS]: createPressTool(browser),
    [BROWSER_TOOLS.SELECT]: createSelectTool(browser),
    [BROWSER_TOOLS.SCROLL]: createScrollTool(browser),
    [BROWSER_TOOLS.CLOSE]: createCloseTool(browser),
    // Extended
    [BROWSER_TOOLS.HOVER]: createHoverTool(browser),
    [BROWSER_TOOLS.BACK]: createBackTool(browser),
    [BROWSER_TOOLS.DIALOG]: createDialogTool(browser),
    [BROWSER_TOOLS.WAIT]: createWaitTool(browser),
    [BROWSER_TOOLS.TABS]: createTabsTool(browser),
    [BROWSER_TOOLS.DRAG]: createDragTool(browser),
    // Escape hatch (1)
    [BROWSER_TOOLS.EVALUATE]: createEvaluateTool(browser),
  };
}
