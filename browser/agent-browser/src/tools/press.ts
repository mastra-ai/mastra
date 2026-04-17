/**
 * browser_press - Press a keyboard key
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { pressInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createPressTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.PRESS,
    description: 'Press a keyboard key (e.g., Enter, Tab, Escape, Control+a).',
    inputSchema: pressInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.press(input, threadId);
    },
  });
}
