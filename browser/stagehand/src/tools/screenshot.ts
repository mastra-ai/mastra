/**
 * stagehand_screenshot - Capture a screenshot of the current page
 */

import { createTool } from '@mastra/core/tools';
import { screenshotInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createScreenshotTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.SCREENSHOT,
    description:
      'Capture a screenshot of the current viewport as a visible PNG (set fullPage: true for full-page capture). Use observe or extract when you only need text or interactive elements — screenshots are expensive. Use this when you need to visually inspect the page, e.g. evaluating images, product photos, layout, design, or colors.',
    inputSchema: screenshotInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.screenshot(input, threadId);
    },
    toModelOutput(output) {
      const result = output as { base64?: string; title?: string; url?: string; message?: string };

      if (typeof result.base64 !== 'string') {
        return {
          type: 'content' as const,
          value: [{ type: 'text' as const, text: result.message ?? 'Failed to capture screenshot.' }],
        };
      }

      return {
        type: 'content' as const,
        value: [
          {
            type: 'media' as const,
            mediaType: 'image/png',
            data: result.base64,
          },
        ],
      };
    },
  });
}
