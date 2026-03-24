/**
 * browser_goto - Navigate to a URL
 */

import { createTool } from '../../tools';
import { gotoInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserGotoTool = createTool({
  id: BROWSER_TOOLS.GOTO,
  description: 'Navigate the browser to a URL.',
  inputSchema: gotoInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.goto(input);
    } catch (error) {
      return handleBrowserError(error, 'Navigation');
    }
  },
});
