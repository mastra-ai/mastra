import type { BrowserToolError, CheckOutput } from '@mastra/core/browser';
import { checkInputSchema, checkOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a check/uncheck tool for checkbox elements.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for check operations
 * @returns A Mastra tool for checking/unchecking checkboxes
 */
export function createCheckTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_check',
    description: 'Check or uncheck a checkbox element using its ref from the snapshot.',
    inputSchema: checkInputSchema,
    outputSchema: checkOutputSchema,
    execute: async (input): Promise<CheckOutput | BrowserToolError> => {
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
        if (input.checked) {
          await locator.check({ timeout: defaultTimeout });
        } else {
          await locator.uncheck({ timeout: defaultTimeout });
        }

        // Verify final state
        const finalState = await locator.isChecked({ timeout: defaultTimeout });
        const page = browser.getPage();

        return {
          success: true,
          checked: finalState,
          url: page.url(),
          hint: 'Take a new snapshot to see updated page state.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('not a checkbox')) {
          return {
            success: false,
            code: 'invalid_element',
            message: `Element ${input.ref} is not a checkbox.`,
            url: page.url(),
            canRetry: false,
          };
        }

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Check operation on ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Check operation failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
