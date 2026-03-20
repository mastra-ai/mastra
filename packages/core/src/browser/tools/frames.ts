/**
 * Browser Frames Tool
 *
 * Manage iframe navigation:
 * - switch_to_frame: Switch to an iframe
 * - switch_to_main: Switch back to main frame
 */

import { createTool } from '../../tools';
import { framesInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserFramesTool = createTool({
  id: 'browser_frames',
  description: `Manage iframe navigation. Actions:
- switch_to_frame: Switch to an iframe (by index, ref, or selector)
- switch_to_main: Switch back to main frame`,
  inputSchema: framesInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.frames(input as Parameters<typeof browser.frames>[0]);
  },
});
