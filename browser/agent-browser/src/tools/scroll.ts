/**
 * browser_scroll - Scroll the page or element
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { scrollInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createScrollTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SCROLL,
    description: 'Scroll the page or a specific element.',
    inputSchema: scrollInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.scroll(input, threadId);
    },
  });
}
