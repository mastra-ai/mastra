/**
 * browser_use_get_url - Get the current URL and title
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { getUrlInputSchema, getUrlOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createGetUrlTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.GET_URL,
    description: 'Get the current URL and title of the page',
    inputSchema: getUrlInputSchema,
    outputSchema: getUrlOutputSchema,
    execute: async (_input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();

      const url = await browser.getCurrentUrl();
      const title = await browser.getTitle();
      return { url, title };
    },
  });
}
