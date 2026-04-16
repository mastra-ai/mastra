/**
 * browser_close - Close the browser
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { closeInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createCloseTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.CLOSE,
    description: 'Close the browser. Only use when done with all browsing.',
    inputSchema: closeInputSchema,
    execute: async (_input, { agent }) => {
      // For thread scope, close only the thread's session
      const threadId = agent?.threadId;
      if (browser.getScope() !== 'shared') {
        if (!threadId) {
          throw new Error('browser_close requires agent.threadId when browser scope is not shared');
        }
        await browser.closeThreadSession(threadId);
        return { success: true, hint: "Thread's browser session closed. A new session will be created on next use." };
      }
      // For shared scope, close the entire browser
      await browser.close();
      return { success: true, hint: 'Browser closed. It will be re-launched automatically on next use.' };
    },
  });
}
