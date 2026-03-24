/**
 * browser_press - Press a keyboard key
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { pressInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createPressTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.PRESS,
    description: 'Press a keyboard key (e.g., Enter, Tab, Escape, Control+a).',
    inputSchema: pressInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.press(input);
      } catch (error) {
        return handleBrowserError(error, 'Press');
      }
    },
  });
}
