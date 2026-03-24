/**
 * browser_dialog - Handle browser dialogs
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { dialogInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createDialogTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.DIALOG,
    description: 'Handle browser dialogs (alert, confirm, prompt). Accept or dismiss them.',
    inputSchema: dialogInputSchema,
    execute: async input => {
      await browser.ensureReady();
      return browser.dialog(input);
    },
  });
}
