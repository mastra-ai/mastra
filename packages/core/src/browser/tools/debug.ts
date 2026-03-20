/**
 * Browser Debug Tool
 *
 * Debugging operations:
 * - highlight: Highlight an element visually
 * - pause: Pause execution (for debugging)
 */

import { createTool } from '../../tools';
import { debugInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserDebugTool = createTool({
  id: 'browser_debug',
  description: `Debugging operations. Actions:
- highlight: Highlight an element with colored border
- pause: Pause execution (for debugging)`,
  inputSchema: debugInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.debug(input as Parameters<typeof browser.debug>[0]);
  },
});
