/**
 * browser_select - Select option from dropdown
 */

import { createTool } from '../../tools';
import { selectInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserSelectTool = createTool({
  id: BROWSER_TOOLS.SELECT,
  description: 'Select an option from a dropdown. Provide value, label, or index.',
  inputSchema: selectInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.select(input);
    } catch (error) {
      return handleBrowserError(error, 'Select');
    }
  },
});
