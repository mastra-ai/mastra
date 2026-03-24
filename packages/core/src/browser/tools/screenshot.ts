/**
 * browser_screenshot - Take a screenshot
 */

import { createTool } from '../../tools';
import { screenshotInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserScreenshotTool = createTool({
  id: BROWSER_TOOLS.SCREENSHOT,
  description: 'Take a screenshot of the page or a specific element.',
  inputSchema: screenshotInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.screenshot(input);
    } catch (error) {
      return handleBrowserError(error, 'Screenshot');
    }
  },
});
