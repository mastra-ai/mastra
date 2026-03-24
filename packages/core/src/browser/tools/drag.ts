/**
 * browser_drag - Drag an element to another element
 */

import { createTool } from '../../tools';
import { dragInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserDragTool = createTool({
  id: BROWSER_TOOLS.DRAG,
  description: 'Drag an element to another element (for Kanban boards, sortable lists, etc.).',
  inputSchema: dragInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.drag(input);
    } catch (error) {
      return handleBrowserError(error, 'Drag');
    }
  },
});
