/**
 * Browser Wait Tool
 *
 * Wait for conditions:
 * - wait: Wait for element, URL, timeout, or network idle
 */

import { createTool } from '../../tools';
import { waitInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserWaitTool = createTool({
  id: 'browser_wait',
  description: `Wait for various conditions:
- Wait for element to appear/disappear
- Wait for URL to change
- Wait for fixed timeout
- Wait for network to become idle`,
  inputSchema: waitInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.wait(input as Parameters<typeof browser.wait>[0]);
  },
});
