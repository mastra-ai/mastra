/**
 * browser_tabs - Manage browser tabs
 */

import { createTool } from '../../tools';
import { tabsInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserTabsTool = createTool({
  id: BROWSER_TOOLS.TABS,
  description: 'Manage browser tabs: list, open new, switch, or close.',
  inputSchema: tabsInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.tabs(input);
    } catch (error) {
      return handleBrowserError(error, 'Tabs');
    }
  },
});
