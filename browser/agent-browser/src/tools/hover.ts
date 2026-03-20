import type { BrowserToolError, HoverOutput } from '@mastra/core/browser';
import { hoverInputSchema, hoverOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a hover tool that hovers over elements using ref identifiers.
 * Useful for triggering dropdown menus, tooltips, and hover states.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for hover operations
 * @returns A Mastra tool for hovering over elements
 */
export function createHoverTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_hover',
    description:
      'Hover over an element using its ref from the snapshot. Useful for revealing dropdown menus or tooltips.',
    inputSchema: hoverInputSchema,
    outputSchema: hoverOutputSchema,
    execute: async (input): Promise<HoverOutput | BrowserToolError> => {
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
        await locator.hover({ timeout: defaultTimeout });
        const page = browser.getPage();

        return {
          success: true,
          url: page.url(),
          hint: 'Take a new snapshot to see any hover-triggered content (dropdowns, tooltips).',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Hover on ${input.ref} timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Hover failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
