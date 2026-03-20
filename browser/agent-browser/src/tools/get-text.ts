import type { BrowserToolError, GetTextOutput } from '@mastra/core/browser';
import { getTextInputSchema, getTextOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a getText tool that extracts text content from elements.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for extracting text from elements
 */
export function createGetTextTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_get_text',
    description: 'Get the text content of an element using its ref from the snapshot.',
    inputSchema: getTextInputSchema,
    outputSchema: getTextOutputSchema,
    execute: async (input): Promise<GetTextOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const locator = browser.getLocatorFromRef(input.ref);

      if (!locator) {
        const page = browser.getPage();
        return {
          success: false,
          code: 'stale_ref',
          message: `Ref ${input.ref} not found. The page has changed.`,
          url: page.url(),
          canRetry: false,
        };
      }

      try {
        const text = await locator.innerText({ timeout: defaultTimeout });
        const page = browser.getPage();

        return {
          success: true,
          text,
          url: page.url(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Getting text from ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Get text failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
