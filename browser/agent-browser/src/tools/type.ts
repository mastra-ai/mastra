/**
 * browser_type - Type text into an element
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { typeInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createTypeTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.TYPE,
    description: 'Type text into an input element. Use clear: true to replace existing content.',
    inputSchema: typeInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.type(input);
      } catch (error) {
        return handleBrowserError(error, 'Type', browser);
      }
    },
  });
}
