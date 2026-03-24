/**
 * browser_scroll - Scroll the page or element
 */

import { createTool } from '../../tools';
import { scrollInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserScrollTool = createTool({
  id: BROWSER_TOOLS.SCROLL,
  description: 'Scroll the page or a specific element.',
  inputSchema: scrollInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.scroll(input);
    } catch (error) {
      return handleBrowserError(error, 'Scroll');
    }
  },
});
