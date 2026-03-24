/**
 * browser_wait - Wait for an element or condition
 */

import { createTool } from '../../tools';
import { waitInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserWaitTool = createTool({
  id: BROWSER_TOOLS.WAIT,
  description: 'Wait for an element to reach a specific state (visible, hidden, attached, detached).',
  inputSchema: waitInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.wait(input);
    } catch (error) {
      return handleBrowserError(error, 'Wait');
    }
  },
});
