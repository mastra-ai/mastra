/**
 * browser_use_navigate - Navigate to a URL
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { navigateInputSchema, navigateOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createNavigateTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.NAVIGATE,
    description: 'Navigate to a URL in the browser',
    inputSchema: navigateInputSchema,
    outputSchema: navigateOutputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();
      await browser.navigateTo(input.url);
      const title = await browser.getTitle();
      return { url: input.url, title };
    },
  });
}
