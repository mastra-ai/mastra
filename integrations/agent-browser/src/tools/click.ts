import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError, createError } from '../errors.js';

/**
 * Zod schema for click tool input parameters.
 */
const clickInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  button: z
    .enum(['left', 'right', 'middle'])
    .optional()
    .default('left')
    .describe('Mouse button to click with'),
});

/**
 * Zod schema for click tool output.
 */
const clickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click succeeded'),
});

/**
 * Input type for the click tool.
 */
export type ClickInput = z.infer<typeof clickInputSchema>;

/**
 * Output type for the click tool.
 */
export type ClickOutput = z.infer<typeof clickOutputSchema>;

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
        return createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page may have changed.`,
          'Take a new snapshot to get current element refs.',
        );
      }

      try {
        await locator.click({
          button: input.button,
          timeout: defaultTimeout,
        });

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Element is blocked by another element (modal, overlay, etc.)
        if (message.includes('intercepts pointer events')) {
          return createError(
            'element_blocked',
            `Element ${input.ref} is blocked by another element.`,
            'Dismiss any modals or overlays covering the element.',
          );
        }

        // Operation timed out
        if (message.includes('Timeout')) {
          return createError(
            'timeout',
            `Click on ${input.ref} timed out.`,
            'Element may be loading. Wait and try again.',
          );
        }

        // Generic browser error
        return createError('browser_error', `Click failed: ${message}`);
      }
    },
  });
}
