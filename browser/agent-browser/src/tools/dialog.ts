/**
 * browser_dialog - Click element and handle resulting dialog
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { dialogInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createDialogTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.DIALOG,
    description:
      'Click an element that triggers a browser dialog (alert, confirm, prompt) and handle it. ' +
      'Use this instead of browser_click when you expect a dialog to appear.',
    inputSchema: dialogInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.dialog(input, threadId);
    },
  });
}
