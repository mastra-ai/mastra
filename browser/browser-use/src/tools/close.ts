/**
 * browser_use_close - Close the browser session
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { closeInputSchema, closeOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createCloseTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.CLOSE,
    description: 'Close the browser session',
    inputSchema: closeInputSchema,
    outputSchema: closeOutputSchema,
    execute: async (_input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.close();
      return { success: true };
    },
  });
}
