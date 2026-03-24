/**
 * browser_back - Go back in browser history
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { backInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createBackTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.BACK,
    description: 'Go back to the previous page in browser history.',
    inputSchema: backInputSchema,
    execute: async () => {
      await browser.ensureReady();
      try {
        return await browser.back();
      } catch (error) {
        return handleBrowserError(error, 'Back', browser);
      }
    },
  });
}
