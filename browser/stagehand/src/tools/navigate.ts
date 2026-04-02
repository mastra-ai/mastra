/**
 * stagehand_navigate - Navigate to a URL
 */

import { createTool } from '@mastra/core/tools';
import { navigateInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createNavigateTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.NAVIGATE,
    description: 'Navigate the browser to a URL.',
    inputSchema: navigateInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.navigate(input, threadId);
    },
  });
}
