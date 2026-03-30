/**
 * browser_use_session_info - Get cloud session information
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { sessionInfoInputSchema, sessionInfoOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createSessionInfoTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.SESSION_INFO,
    description: 'Get information about the current cloud browser session',
    inputSchema: sessionInfoInputSchema,
    outputSchema: sessionInfoOutputSchema,
    execute: async (_input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);

      const info = browser.getSessionInfo();
      return {
        id: info?.id ?? null,
        liveUrl: info?.liveUrl ?? null,
        status: info?.status ?? null,
      };
    },
  });
}
