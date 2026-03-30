/**
 * browser_use_tabs - Manage browser tabs via CDP
 */

import { createTool } from '@mastra/core/tools';

import type { BrowserUseBrowser } from '../browser-use-browser';
import { tabsInputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createTabsTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.TABS,
    description:
      'Manage browser tabs. Actions: "list" shows all tabs, "new" opens a tab (optionally with URL), "switch" changes to tab by index, "close" closes a tab.',
    inputSchema: tabsInputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();
      return await browser.tabs(input);
    },
  });
}
