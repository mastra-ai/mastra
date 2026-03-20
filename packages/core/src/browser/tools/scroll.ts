/**
 * Browser Scroll Tool
 *
 * Handles scrolling operations:
 * - scroll: Scroll in a direction or to element
 * - scroll_to: Scroll to specific coordinates
 */

import { createTool } from '../../tools';
import { scrollInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserScrollTool = createTool({
  id: 'browser_scroll',
  description: `Scroll the browser page. Actions:
- scroll: Scroll in a direction (up/down/left/right) or to element
- scroll_to: Scroll to specific x/y coordinates`,
  inputSchema: scrollInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.scroll(input as Parameters<typeof browser.scroll>[0]);
  },
});
