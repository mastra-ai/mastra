/**
 * browser_hover - Hover over an element
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { hoverInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createHoverTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.HOVER,
    description: 'Hover over an element to trigger hover states (dropdowns, tooltips).',
    inputSchema: hoverInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.hover(input, threadId);
    },
  });
}
