import type { BrowserToolError, SetViewportOutput } from '@mastra/core/browser';
import { setViewportInputSchema, setViewportOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a setViewport tool that changes the browser viewport size.
 * Useful for testing responsive designs or mobile layouts.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for setting viewport size
 */
export function createSetViewportTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_viewport',
    description:
      'Set the browser viewport size. Common sizes: desktop (1280x720), mobile (375x812 for iPhone), tablet (768x1024).',
    inputSchema: setViewportInputSchema,
    outputSchema: setViewportOutputSchema,
    execute: async (input): Promise<SetViewportOutput | BrowserToolError> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        await page.setViewportSize({
          width: input.width,
          height: input.height,
        });

        // Verify the new viewport
        const newViewport = page.viewportSize();

        return {
          success: true,
          viewport: {
            width: newViewport?.width ?? input.width,
            height: newViewport?.height ?? input.height,
            deviceScaleFactor: input.deviceScaleFactor ?? 1,
          },
          url: page.url(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        return {
          success: false,
          code: 'browser_error',
          message: `Set viewport failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
