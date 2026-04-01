/**
 * stagehand_screenshot - Take a screenshot
 */

import { createTool } from '@mastra/core/tools';
import { screenshotInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createScreenshotTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.SCREENSHOT,
    description: 'Take a screenshot of the current page.',
    inputSchema: screenshotInputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();
      return await browser.screenshot(input);
    },
  });
}
