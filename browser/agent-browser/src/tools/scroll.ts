/**
 * browser_scroll - Scroll the page or element
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { scrollInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createScrollTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SCROLL,
    description: 'Scroll the page or a specific element.',
    inputSchema: scrollInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.scroll(input);
      } catch (error) {
        return handleBrowserError(error, 'Scroll', browser);
      }
    },
  });
}
