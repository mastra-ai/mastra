/**
 * browser_back - Go back in browser history
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { backInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createBackTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.BACK,
    description: 'Go back to the previous page in browser history.',
    inputSchema: backInputSchema,
    execute: async (_input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();
      return browser.back();
    },
  });
}
