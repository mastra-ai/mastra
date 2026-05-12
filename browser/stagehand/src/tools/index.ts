/**
 * Stagehand Tools
 *
 * Creates AI-powered browser tools bound to a StagehandBrowser instance.
 */

import type { Tool } from '@mastra/core/tools';
import type { StagehandBrowser } from '../stagehand-browser';
import { createActTool } from './act';
import { createCloseTool } from './close';
import { STAGEHAND_TOOLS } from './constants';
import { createExtractTool } from './extract';
import { createNavigateTool } from './navigate';
import { createObserveTool } from './observe';
import { createScreenshotTool } from './screenshot';
import { createTabsTool } from './tabs';

export { STAGEHAND_TOOLS, type StagehandToolName } from './constants';

/**
 * Creates all Stagehand tools bound to a StagehandBrowser instance.
 * The browser is lazily initialized on first tool use.
 */
export function createStagehandTools(browser: StagehandBrowser): Record<string, Tool<any, any>> {
  return {
    // Core AI
    [STAGEHAND_TOOLS.ACT]: createActTool(browser),
    [STAGEHAND_TOOLS.EXTRACT]: createExtractTool(browser),
    [STAGEHAND_TOOLS.OBSERVE]: createObserveTool(browser),
    // Navigation & State
    [STAGEHAND_TOOLS.NAVIGATE]: createNavigateTool(browser),
    [STAGEHAND_TOOLS.TABS]: createTabsTool(browser),
    [STAGEHAND_TOOLS.CLOSE]: createCloseTool(browser),
    // Utility
    [STAGEHAND_TOOLS.SCREENSHOT]: createScreenshotTool(browser),
  };
}
