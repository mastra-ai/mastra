import type { IsVisibleOutput } from '@mastra/core/browser';
import { isVisibleInputSchema, isVisibleOutputSchema, ErrorCode, BrowserToolError } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createIsVisibleTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_is_visible',
    description: 'Check if an element is visible on the page.',
    inputSchema: isVisibleInputSchema,
    outputSchema: isVisibleOutputSchema,
    execute: async ({ context }): Promise<IsVisibleOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return {
            success: false,
            code: ErrorCode.STALE_REF,
            message: `Element reference "${ref}" not found. Take a new snapshot.`,
          };
        }

        // Check visibility via bounding box - if null, element is not visible
        const box = await locator.boundingBox();
        const page = browser.getPage();

        return {
          success: true,
          visible: box !== null,
          url: page.url(),
        };
      } catch (error) {
        if (error instanceof BrowserToolError) {
          return {
            success: false,
            code: error.code,
            message: error.message,
          };
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}
