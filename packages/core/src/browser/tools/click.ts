/**
 * browser_click - Click an element
 */

import { createTool } from '../../tools';
import { clickInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserClickTool = createTool({
  id: BROWSER_TOOLS.CLICK,
  description: 'Click an element. Use clickCount: 2 for double-click.',
  inputSchema: clickInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.click(input);
    } catch (error) {
      return handleBrowserError(error, 'Click');
    }
  },
});
