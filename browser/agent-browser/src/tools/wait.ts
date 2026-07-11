/**
 * browser_wait - Wait for an element or condition
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { waitInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createWaitTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.WAIT,
    description: 'Wait for an element to appear, disappear, or reach a state.',
    inputSchema: waitInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.wait(input, threadId);
    },
  });
}
