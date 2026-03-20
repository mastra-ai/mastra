import type { BrowserToolError, FillOutput } from '@mastra/core/browser';
import { fillInputSchema, fillOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a fill tool that clears an element and fills it with text.
 * Unlike type, fill clears existing content first.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for fill operations
 * @returns A Mastra tool for filling elements with text
 */
export function createFillTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_fill',
    description:
      'Clear and fill an input element with text. Unlike browser_type, this clears existing content first. Best for form inputs.',
    inputSchema: fillInputSchema,
    outputSchema: fillOutputSchema,
    execute: async (input): Promise<FillOutput | BrowserToolError> => {
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
        await locator.fill(input.text, { timeout: defaultTimeout });

        // Get current value to confirm
        let value: string | undefined;
        try {
          value = await locator.inputValue({ timeout: 1000 });
        } catch {
          // Not all elements support inputValue
        }

        const page = browser.getPage();

        return {
          success: true,
          value,
          url: page.url(),
          hint: 'Take a new snapshot to see updated page state.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('not an input')) {
          return {
            success: false,
            code: 'invalid_element',
            message: `Element ${input.ref} is not an input element that can be filled.`,
            url: page.url(),
            canRetry: false,
          };
        }

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Fill on ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Fill failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
