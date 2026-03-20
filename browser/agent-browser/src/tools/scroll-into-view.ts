import type { BrowserToolError, ScrollIntoViewOutput } from '@mastra/core/browser';
import { scrollIntoViewInputSchema, scrollIntoViewOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a scrollIntoView tool that scrolls an element into the viewport.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for scrolling elements into view
 */
export function createScrollIntoViewTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_scroll_into_view',
    description: 'Scroll an element into the viewport using its ref from the snapshot.',
    inputSchema: scrollIntoViewInputSchema,
    outputSchema: scrollIntoViewOutputSchema,
    execute: async (input): Promise<ScrollIntoViewOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const locator = browser.getLocatorFromRef(input.ref);

      if (!locator) {
        const page = browser.getPage();
        return {
          success: false,
          code: 'stale_ref',
          message: `Ref ${input.ref} not found. The page has changed.`,
          url: page.url(),
          hint: 'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
          canRetry: false,
        };
      }

      try {
        // First scroll into view
        await locator.scrollIntoViewIfNeeded({ timeout: defaultTimeout });

        // Then use evaluate to adjust alignment if needed
        if (input.block && input.block !== 'nearest') {
          await locator.evaluate((el: unknown, block: string) => {
            (el as HTMLElement).scrollIntoView({ block: block as ScrollLogicalPosition, behavior: 'instant' });
          }, input.block);
        }

        const page = browser.getPage();

        return {
          success: true,
          url: page.url(),
          hint: 'Element is now visible. Take a new snapshot to see updated page state.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Scroll into view for ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Scroll into view failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
