import type { GetValueOutput } from '@mastra/core/browser';
import { createError, getValueInputSchema, getValueOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetValueTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_value',
    description: 'Get the current value of an input, textarea, or select element',
    inputSchema: getValueInputSchema,
    outputSchema: getValueOutputSchema,
    execute: async ({ context: { ref } }): Promise<GetValueOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return createError('stale_ref', `Element ref ${ref} is no longer valid. Take a new snapshot.`);
        }

        const value = await locator.inputValue();

        return {
          success: true,
          value,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'get_value_failed',
          message: `Failed to get value: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}
