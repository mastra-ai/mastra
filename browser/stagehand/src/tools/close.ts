/**
 * stagehand_close - Close the browser
 */

import { createTool } from '@mastra/core/tools';
import { closeInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createCloseTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.CLOSE,
    description: 'Close the browser. Only use when done with all browsing.',
    inputSchema: closeInputSchema,
    execute: async (_input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.close();
      return {
        success: true,
        hint: 'Browser closed. It will be re-launched automatically on next use.',
      };
    },
  });
}
