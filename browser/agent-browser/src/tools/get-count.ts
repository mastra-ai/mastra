import type { GetCountOutput } from '@mastra/core/browser';
import { getCountInputSchema, getCountOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetCountTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_count',
    description: 'Get the count of elements matching a selector or reference.',
    inputSchema: getCountInputSchema,
    outputSchema: getCountOutputSchema,
    execute: async ({ context }): Promise<GetCountOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        // Use evaluate to count matching elements
        const count = await page.evaluate(
          (selector: string) => {
            // If it looks like an element ref (@e1), we can't count refs directly
            if (selector.startsWith('@')) {
              return 1; // Refs always refer to a single element
            }
            return document.querySelectorAll(selector).length;
          },
          ref.startsWith('@') ? ref : ref,
        );

        return {
          success: true,
          count: ref.startsWith('@') ? 1 : (count as number),
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'browser_error',
          message,
        };
      }
    },
  });
}
