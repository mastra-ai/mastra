import { createTool } from '@mastra/core/tools';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError } from '../errors.js';
import { clickInputSchema, clickOutputSchema, type ClickOutput } from '../types.js';

/**
 * Creates a click tool that clicks on elements using ref identifiers.
 *
 * Refs are obtained from accessibility snapshots (e.g., @e1, @e2, @e3).
 * The tool resolves refs to Playwright locators using BrowserManager.getLocatorFromRef().
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for click operations
 * @returns A Mastra tool for clicking elements
 *
 * @example
 * ```typescript
 * const clickTool = createClickTool(() => browserManager, 5000);
 * await clickTool.execute({ ref: '@e5', button: 'left' });
 * ```
 */
export function createClickTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_click',
    description: 'Click on an element using its ref from the snapshot.',
    inputSchema: clickInputSchema,
    outputSchema: clickOutputSchema,
    execute: async (input): Promise<ClickOutput | BrowserToolError> => {
      const browser = await getBrowser();

      // Resolve ref to Playwright locator
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
        await locator.click({
          button: input.button,
          timeout: defaultTimeout,
        });

        // Get current URL after click to help agent understand page state
        const page = browser.getPage();
        const url = page.url();

        return {
          success: true,
          url,
          hint: 'Take a new snapshot to see updated page state and get fresh refs.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();
        const url = page.url();

        // Element is blocked by another element (modal, overlay, etc.)
        if (errorMsg.includes('intercepts pointer events')) {
          return {
            success: false,
            code: 'element_blocked',
            message: `Element ${input.ref} is blocked by another element (modal/overlay).`,
            url,
            hint: 'Take a new snapshot to see what is blocking. Dismiss any modals or scroll the element into view.',
            canRetry: true,
          };
        }

        // Operation timed out
        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Click on ${input.ref} timed out.`,
            url,
            hint: 'Take a new snapshot - the element may have moved or the page may have changed.',
            canRetry: true,
          };
        }

        // Generic browser error
        return {
          success: false,
          code: 'browser_error',
          message: `Click failed: ${errorMsg}`,
          url,
          hint: 'Take a new snapshot to see the current page state.',
          canRetry: false,
        };
      }
    },
  });
}
