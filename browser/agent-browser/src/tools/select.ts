/**
 * browser_select - Select option from dropdown
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { selectInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createSelectTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SELECT,
    description: 'Select an option from a dropdown by value, label, or index.',
    inputSchema: selectInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.select(input);
      } catch (error) {
        return handleBrowserError(error, 'Select', browser);
      }
    },
  });
}
