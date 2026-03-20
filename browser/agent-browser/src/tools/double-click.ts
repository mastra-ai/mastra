import type { BrowserToolError, DoubleClickOutput } from '@mastra/core/browser';
import { doubleClickInputSchema, doubleClickOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a double-click tool that double-clicks on elements using ref identifiers.
 * Useful for selecting text, opening files, or triggering double-click events.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for double-click operations
 * @returns A Mastra tool for double-clicking elements
 */
export function createDoubleClickTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_double_click',
    description:
      'Double-click on an element using its ref from the snapshot. Useful for selecting text or opening items.',
    inputSchema: doubleClickInputSchema,
    outputSchema: doubleClickOutputSchema,
    execute: async (input): Promise<DoubleClickOutput | BrowserToolError> => {
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
        await locator.dblclick({
          button: input.button,
          timeout: defaultTimeout,
        });

        const page = browser.getPage();

        return {
          success: true,
          url: page.url(),
          hint: 'Take a new snapshot to see updated page state.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('intercepts pointer events')) {
          return {
            success: false,
            code: 'element_blocked',
            message: `Element ${input.ref} is blocked by another element.`,
            url: page.url(),
            hint: 'Take a new snapshot to see what is blocking.',
            canRetry: true,
          };
        }

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Double-click on ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Double-click failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
