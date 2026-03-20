import type { GetAttributeOutput } from '@mastra/core/browser';
import { createError, getAttributeInputSchema, getAttributeOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetAttributeTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_attribute',
    description: 'Get an attribute value from an element (e.g., href, src, data-id)',
    inputSchema: getAttributeInputSchema,
    outputSchema: getAttributeOutputSchema,
    execute: async ({ context: { ref, name } }): Promise<GetAttributeOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return createError('stale_ref', `Element ref ${ref} is no longer valid. Take a new snapshot.`);
        }

        const value = await locator.getAttribute(name);

        return {
          success: true,
          value,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'get_attribute_failed',
          message: `Failed to get attribute: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}
