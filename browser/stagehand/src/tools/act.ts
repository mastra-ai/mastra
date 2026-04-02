/**
 * stagehand_act - Perform an action using natural language
 */

import { createTool } from '@mastra/core/tools';
import { actInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createActTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.ACT,
    description:
      'Perform an action on the page using natural language. Examples: "click the login button", "type hello into the search box", "scroll down".',
    inputSchema: actInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.act(input, threadId);
    },
  });
}
