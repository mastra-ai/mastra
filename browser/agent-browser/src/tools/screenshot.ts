/**
 * browser_screenshot - Take a screenshot
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { screenshotInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createScreenshotTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SCREENSHOT,
    description: 'Take a screenshot of the page or a specific element.',
    inputSchema: screenshotInputSchema,
    execute: async input => {
      await browser.ensureReady();
      return browser.screenshot(input);
    },
  });
}
