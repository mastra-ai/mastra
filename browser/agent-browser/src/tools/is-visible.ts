import type { IsVisibleOutput } from '@mastra/core/browser';
import { isVisibleInputSchema, isVisibleOutputSchema } from '@mastra/core/browser';
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
            code: 'stale_ref',
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
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}
