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
    execute: async () => {
      await browser.close();
      return { success: true, hint: 'Browser closed. It will be re-launched automatically on next use.' };
    },
  });
}
