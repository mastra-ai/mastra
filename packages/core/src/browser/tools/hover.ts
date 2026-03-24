/**
 * browser_hover - Hover over an element
 */

import { createTool } from '../../tools';
import { hoverInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserHoverTool = createTool({
  id: BROWSER_TOOLS.HOVER,
  description: 'Hover over an element to trigger hover states, tooltips, or menus.',
  inputSchema: hoverInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.hover(input);
    } catch (error) {
      return handleBrowserError(error, 'Hover');
    }
  },
});
