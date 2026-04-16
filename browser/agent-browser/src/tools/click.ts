/**
 * browser_click - Click an element
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { clickInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';

export function createClickTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.CLICK,
    description: 'Click an element using its ref from a snapshot. Use clickCount: 2 for double-click.',
    inputSchema: clickInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.click(input, threadId);
    },
  });
}
