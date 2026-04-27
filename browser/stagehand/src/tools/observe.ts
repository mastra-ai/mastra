/**
 * stagehand_observe - Discover actionable elements on a page
 */

import { createTool } from '@mastra/core/tools';
import { observeInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createObserveTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.OBSERVE,
    description:
      "Discover actionable elements on the page. Returns a list of actions that can be performed. Use this to understand what's on the page before acting.",
    inputSchema: observeInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.observe(input, threadId);
    },
  });
}
