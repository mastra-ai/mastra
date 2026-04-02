/**
 * browser_type - Type text into an element
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { typeInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createTypeTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.TYPE,
    description: 'Type text into an input element. Use clear: true to replace existing content.',
    inputSchema: typeInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.type(input, threadId);
    },
  });
}
