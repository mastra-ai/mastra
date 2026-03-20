import type { GetBoundingBoxOutput } from '@mastra/core/browser';
import { getBoundingBoxInputSchema, getBoundingBoxOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetBoundingBoxTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_bounding_box',
    description: 'Get the bounding box (position and size) of an element.',
    inputSchema: getBoundingBoxInputSchema,
    outputSchema: getBoundingBoxOutputSchema,
    execute: async ({ context }): Promise<GetBoundingBoxOutput> => {
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

        const box = await locator.boundingBox();
        const page = browser.getPage();

        return {
          success: true,
          box: box
            ? {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              }
            : null,
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
