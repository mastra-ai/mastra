/**
 * browser_close - Close the browser
 */

import { createTool } from '../../tools';
import { closeInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserCloseTool = createTool({
  id: BROWSER_TOOLS.CLOSE,
  description: 'Close the browser session.',
  inputSchema: closeInputSchema,
  execute: async (_input, context) => {
    const browser = requireBrowser(context);
    try {
      await browser.close();
      return { success: true };
    } catch (error) {
      return handleBrowserError(error, 'Close');
    }
  },
});
