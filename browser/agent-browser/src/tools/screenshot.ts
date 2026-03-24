/**
 * browser_screenshot - Take a screenshot
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { screenshotInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';

export function createScreenshotTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SCREENSHOT,
    description: 'Take a screenshot of the page or a specific element.',
    inputSchema: screenshotInputSchema,
    execute: async input => {
      await browser.ensureReady();
      try {
        return await browser.screenshot(input);
      } catch (error) {
        return handleBrowserError(error, 'Screenshot', browser);
      }
    },
  });
}
