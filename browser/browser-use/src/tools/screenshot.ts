/**
 * browser_use_screenshot - Take a screenshot
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { screenshotInputSchema, screenshotOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createScreenshotTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.SCREENSHOT,
    description: 'Take a screenshot of the current page',
    inputSchema: screenshotInputSchema,
    outputSchema: screenshotOutputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();

      const cdpSession = await browser.getCdpSession();

      // Capture screenshot via CDP
      const result = (await cdpSession.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: input.quality ?? 80,
      })) as { data: string };

      const url = await browser.getCurrentUrl();

      return { data: result.data, url };
    },
  });
}
