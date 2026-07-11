/**
 * stagehand_tabs - Manage browser tabs
 */

import { createTool } from '@mastra/core/tools';
import { tabsInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createTabsTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.TABS,
    description:
      'Manage browser tabs. Actions: "list" shows all tabs, "new" opens a tab (optionally with URL), "switch" changes to tab by index, "close" closes a tab.',
    inputSchema: tabsInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.tabs(input, threadId);
    },
  });
}
