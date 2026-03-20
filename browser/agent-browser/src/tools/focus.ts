import type { BrowserToolError, FocusOutput } from '@mastra/core/browser';
import { focusInputSchema, focusOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a focus tool that focuses on elements using ref identifiers.
 * Useful for preparing to type into an element or triggering focus events.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for focus operations
 * @returns A Mastra tool for focusing elements
 */
export function createFocusTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_focus',
    description:
      'Focus on an element using its ref from the snapshot. Useful before typing or to trigger focus events.',
    inputSchema: focusInputSchema,
    outputSchema: focusOutputSchema,
    execute: async (input): Promise<FocusOutput | BrowserToolError> => {
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
        await locator.focus({ timeout: defaultTimeout });
        const page = browser.getPage();

        return {
          success: true,
          url: page.url(),
          hint: 'Element is now focused. You can use browser_press to type keys.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Focus on ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Focus failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
