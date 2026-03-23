/**
 * Browser State Tool
 *
 * Manage browser state:
 * - get_cookies: Get browser cookies
 * - set_cookie: Set a cookie
 * - clear_cookies: Clear all cookies
 * - get_viewport: Get viewport size
 * - set_viewport: Set viewport size
 */

import { createTool } from '../../tools';
import { browserStateInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserStateTool = createTool({
  id: 'browser_state',
  description: `Manage browser state. Actions:
- get_cookies: Get browser cookies (optionally filtered by URL)
- set_cookie: Set a cookie
- clear_cookies: Clear all cookies
- get_viewport: Get current viewport size
- set_viewport: Set viewport width and height`,
  inputSchema: browserStateInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.browserState(input as Parameters<typeof browser.browserState>[0]);
  },
});
