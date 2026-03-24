/**
 * browser_dialog - Handle browser dialogs
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { dialogInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createDialogTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.DIALOG,
    description: 'Handle browser dialogs (alert, confirm, prompt). Accept or dismiss them.',
    inputSchema: dialogInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.dialog(input);
      } catch (error) {
        return handleBrowserError(error, 'Dialog');
      }
    },
  });
}
