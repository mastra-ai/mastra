/**
 * Browser Navigation Tool
 *
 * Handles all navigation actions:
 * - goto: Navigate to a URL
 * - back: Go to previous page in history
 * - forward: Go to next page in history
 * - reload: Refresh the current page
 * - close: Close the browser session
 */

import { createTool } from '../../tools';
import { navigateInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserNavigateTool = createTool({
  id: 'browser_navigate',
  description: `Navigate the browser. Actions:
- goto: Navigate to a URL
- back: Go to previous page in history
- forward: Go to next page in history  
- reload: Refresh the current page
- close: Close the browser session`,
  inputSchema: navigateInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    // Type assertion safe because schema defaults are applied before execute
    return browser.navigate(input as Parameters<typeof browser.navigate>[0]);
  },
});
