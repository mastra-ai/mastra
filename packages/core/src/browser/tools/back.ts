/**
 * browser_back - Go back in browser history
 */

import { createTool } from '../../tools';
import { backInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserBackTool = createTool({
  id: BROWSER_TOOLS.BACK,
  description: 'Go back to the previous page in browser history.',
  inputSchema: backInputSchema,
  execute: async (_input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.back();
    } catch (error) {
      return handleBrowserError(error, 'Back');
    }
  },
});
