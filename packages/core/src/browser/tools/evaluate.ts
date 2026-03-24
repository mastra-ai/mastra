/**
 * browser_evaluate - Execute JavaScript in the browser
 */

import { createTool } from '../../tools';
import { evaluateInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserEvaluateTool = createTool({
  id: BROWSER_TOOLS.EVALUATE,
  description: 'Execute JavaScript in the browser context. Use for advanced operations not covered by other tools.',
  inputSchema: evaluateInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.evaluate(input);
    } catch (error) {
      return handleBrowserError(error, 'Evaluate');
    }
  },
});
