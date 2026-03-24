/**
 * browser_type - Type text into an element
 */

import { createTool } from '../../tools';
import { typeInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserTypeTool = createTool({
  id: BROWSER_TOOLS.TYPE,
  description: 'Type text into an input element. Set clear: true to clear existing content first.',
  inputSchema: typeInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.type(input);
    } catch (error) {
      return handleBrowserError(error, 'Type');
    }
  },
});
