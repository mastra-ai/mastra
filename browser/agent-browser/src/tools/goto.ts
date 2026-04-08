/**
 * browser_goto - Navigate to a URL
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { gotoInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';

export function createGotoTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.GOTO,
    description: 'Navigate the browser to a URL.',
    inputSchema: gotoInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.goto(input, threadId);
    },
  });
}
