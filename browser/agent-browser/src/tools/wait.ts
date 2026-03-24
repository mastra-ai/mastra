/**
 * browser_wait - Wait for an element or condition
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { waitInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createWaitTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.WAIT,
    description: 'Wait for an element to appear, disappear, or reach a state.',
    inputSchema: waitInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.wait(input);
      } catch (error) {
        return handleBrowserError(error, 'Wait');
      }
    },
  });
}
