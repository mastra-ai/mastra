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
import { createError } from '../errors';
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

    try {
      return await browser.navigate(input as Parameters<typeof browser.navigate>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Timeout
      if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted')) {
        return createError('timeout', 'Navigation timed out.', 'Try a different URL or check your network connection.');
      }

      // Browser not launched
      if (msg.includes('not launched') || msg.includes('Browser is not launched')) {
        return createError(
          'browser_error',
          'Browser was not initialized.',
          'This is an internal error - please try again.',
        );
      }

      // Generic error
      return createError(
        'browser_error',
        `Navigation failed: ${msg}`,
        'Check that the URL is valid and the site is accessible.',
      );
    }
  },
});
