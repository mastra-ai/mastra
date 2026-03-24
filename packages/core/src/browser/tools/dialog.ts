/**
 * browser_dialog - Handle browser dialogs
 */

import { createTool } from '../../tools';
import { dialogInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserDialogTool = createTool({
  id: BROWSER_TOOLS.DIALOG,
  description: 'Handle browser dialogs (alert, confirm, prompt). Accept or dismiss them.',
  inputSchema: dialogInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.dialog(input);
    } catch (error) {
      return handleBrowserError(error, 'Dialog');
    }
  },
});
