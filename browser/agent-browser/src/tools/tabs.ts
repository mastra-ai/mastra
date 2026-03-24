/**
 * browser_tabs - Manage browser tabs
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { tabsInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createTabsTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.TABS,
    description: 'Manage browser tabs: list, open new, switch, or close tabs.',
    inputSchema: tabsInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.tabs(input);
      } catch (error) {
        return handleBrowserError(error, 'Tabs');
      }
    },
  });
}
