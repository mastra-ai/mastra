/**
 * Browser Tabs Tool
 *
 * Manage browser tabs:
 * - list: List all open tabs
 * - new: Open a new tab
 * - switch: Switch to a tab
 * - close_tab: Close a tab
 */

import { createTool } from '../../tools';
import { tabsInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserTabsTool = createTool({
  id: 'browser_tabs',
  description: `Manage browser tabs. Actions:
- list: List all open tabs
- new: Open a new tab (optionally with URL)
- switch: Switch to a tab by index
- close_tab: Close a tab by index`,
  inputSchema: tabsInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.tabs(input as Parameters<typeof browser.tabs>[0]);
  },
});
