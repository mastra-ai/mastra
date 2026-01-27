import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError, createError } from '../errors.js';

/**
 * Zod schema for type tool input parameters.
 */
const typeInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e3)'),
  text: z.string().describe('Text to type'),
  clearFirst: z
    .boolean()
    .optional()
    .default(false)
    .describe('Clear existing content before typing'),
});

/**
 * Zod schema for type tool output.
 */
const typeOutputSchema = z.object({
  success: z.boolean().describe('Whether the type operation succeeded'),
  value: z.string().optional().describe('Current field value after typing'),
});

/**
 * Input type for the type tool.
 */
export type TypeInput = z.infer<typeof typeInputSchema>;

/**
 * Output type for the type tool.
 */
export type TypeOutput = z.infer<typeof typeOutputSchema>;

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

      if (!locator) {
        return createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page may have changed.`,
          'Take a new snapshot to get current element refs.',
        );
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

        return { success: true, value };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Element cannot receive text input
        if (message.includes('not an input') || message.includes('Cannot type') || message.includes('not focusable')) {
          return createError(
            'not_focusable',
            `Element ${input.ref} cannot receive text input.`,
            'Only textbox and searchbox elements can be typed into.',
          );
        }

        // Generic browser error
        return createError('browser_error', `Type failed: ${message}`);
      }
    },
  });
}
