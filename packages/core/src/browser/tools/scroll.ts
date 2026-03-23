/**
 * Browser Scroll Tool
 *
 * Handles scrolling operations:
 * - scroll: Scroll in a direction
 * - into_view: Scroll element into view
 */

import { createTool } from '../../tools';
import { createError } from '../errors';
import { scrollInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserScrollTool = createTool({
  id: 'browser_scroll',
  description: `Scroll the page or elements. Actions:
- scroll: Scroll up/down/left/right by amount (default 300px)
- into_view: Scroll an element into view`,
  inputSchema: scrollInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.scroll(input as Parameters<typeof browser.scroll>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('STALE_REF:')) {
        const ref = msg.split('STALE_REF:')[1];
        return createError(
          'stale_ref',
          `Ref ${ref} not found. The page has changed.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      return createError('browser_error', `Scroll failed: ${msg}`);
    }
  },
});
