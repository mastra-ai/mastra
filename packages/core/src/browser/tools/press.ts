/**
 * browser_press - Press a keyboard key
 */

import { createTool } from '../../tools';
import { pressInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserPressTool = createTool({
  id: BROWSER_TOOLS.PRESS,
  description: 'Press a keyboard key (Enter, Tab, Escape, etc.). Use "Control+a" for key combinations.',
  inputSchema: pressInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.press(input);
    } catch (error) {
      return handleBrowserError(error, 'Key press');
    }
  },
});
