import { createTool } from '@mastra/core/tools';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError } from '../errors.js';
import { typeInputSchema, typeOutputSchema, type TypeOutput } from '../types.js';

/**
 * Creates a type tool that types text into form fields using ref identifiers.
 *
 * Refs are obtained from accessibility snapshots (e.g., @e1, @e2, @e3).
 * The tool uses Playwright's fill() method for reliable text entry.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for type operations
 * @returns A Mastra tool for typing into form fields
 *
 * @example
 * ```typescript
 * const typeTool = createTypeTool(() => browserManager, 5000);
 * await typeTool.execute({ ref: '@e3', text: 'hello@example.com', clearFirst: true });
 * ```
 */
export function createTypeTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_type',
    description: 'Type text into an input field using its ref.',
    inputSchema: typeInputSchema,
    outputSchema: typeOutputSchema,
    execute: async (input): Promise<TypeOutput | BrowserToolError> => {
      const browser = await getBrowser();

      // Resolve ref to Playwright locator
      const locator = browser.getLocatorFromRef(input.ref);

      const page = browser.getPage();

      if (!locator) {
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
        // Focus element first to ensure it's ready
        await locator.focus({ timeout: defaultTimeout });

        // Clear existing content if requested
        if (input.clearFirst) {
          await locator.fill('', { timeout: defaultTimeout });
        }

        // Use fill() for reliable text entry (not deprecated type())
        await locator.fill(input.text, { timeout: defaultTimeout });

        // Get current value for verification
        const value = await locator.inputValue({ timeout: 1000 });

        return {
          success: true,
          value,
          url: page.url(),
          hint: 'Take a new snapshot if you need to interact with more elements.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const url = page.url();

        // Element cannot receive text input
        if (
          errorMsg.includes('is not an <input>') ||
          errorMsg.includes('not an input') ||
          errorMsg.includes('Cannot type') ||
          errorMsg.includes('not focusable') ||
          errorMsg.includes('does not have a role allowing')
        ) {
          return {
            success: false,
            code: 'not_editable',
            message: `Element ${input.ref} is not a text input field (it's a ${errorMsg.includes('link') ? 'link' : 'non-editable element'}).`,
            url,
            hint: 'Take a new snapshot and look for elements with role "textbox" or "searchbox" - those are the actual input fields you can type into.',
            canRetry: false,
          };
        }

        // Generic browser error
        return {
          success: false,
          code: 'browser_error',
          message: `Type failed: ${errorMsg}`,
          url,
          hint: 'Take a new snapshot to see the current page state.',
          canRetry: false,
        };
      }
    },
  });
}
