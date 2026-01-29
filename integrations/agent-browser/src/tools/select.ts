import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError, createError } from '../errors.js';

/**
 * Zod schema for select tool input parameters.
 */
const selectInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5) - should be a select/combobox element'),
  value: z.string().optional().describe('Option value to select'),
  label: z.string().optional().describe('Option label/text to select (use if value is unknown)'),
  index: z.number().optional().describe('Option index to select (0-based)'),
});

/**
 * Zod schema for select tool output.
 */
const selectOutputSchema = z.object({
  success: z.boolean().describe('Whether the selection succeeded'),
  selectedValue: z.string().optional().describe('The value that was selected'),
  selectedLabel: z.string().optional().describe('The label/text of the selected option'),
  url: z.string().optional().describe('Current page URL after selection'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if selection failed'),
  message: z.string().optional().describe('Error message if selection failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

/**
 * Creates a select tool for interacting with dropdown/select elements.
 *
 * This tool handles both native <select> elements and attempts to work with
 * custom dropdown implementations by using Playwright's selectOption().
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for selecting dropdown options
 */
export function createSelectTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_select',
    description:
      'Select an option from a dropdown/select element. Use value, label, or index to specify which option.',
    inputSchema: selectInputSchema,
    outputSchema: selectOutputSchema,
    execute: async (input): Promise<z.infer<typeof selectOutputSchema> | BrowserToolError> => {
      const browser = await getBrowser();

      // Validate that at least one selection method is provided
      if (!input.value && !input.label && input.index === undefined) {
        return createError(
          'browser_error',
          'Must provide value, label, or index to select an option.',
          'Specify which option to select using value, label, or index parameter.',
        );
      }

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
        // Build selection options
        const selectOptions: { value?: string; label?: string; index?: number } = {};
        if (input.value) selectOptions.value = input.value;
        if (input.label) selectOptions.label = input.label;
        if (input.index !== undefined) selectOptions.index = input.index;

        // Use Playwright's selectOption for native selects
        const selectedValues = await locator.selectOption(selectOptions, {
          timeout: defaultTimeout,
        });

        // Get selected value info
        const selectedValue = selectedValues[0] || '';

        // Try to get the label of the selected option
        let selectedLabel = '';
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selectedLabel = await locator.evaluate((el: any) => {
            const option = el.options?.[el.selectedIndex];
            return option ? option.text : '';
          });
        } catch {
          // Ignore if we can't get the label
        }

        const page = browser.getPage();
        const url = page.url();

        return {
          success: true,
          selectedValue,
          selectedLabel,
          url,
          hint: 'Take a new snapshot if you need to interact with more elements.',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Not a select element - suggest clicking instead
        if (errorMessage.includes('not a <select> element') || errorMessage.includes('selectOption')) {
          return createError(
            'browser_error',
            `Element ${input.ref} is not a native select. It may be a custom dropdown.`,
            'For custom dropdowns: 1) Click the dropdown to open it, 2) Take a snapshot, 3) Click the desired option.',
          );
        }

        // Option not found
        if (errorMessage.includes('No option') || errorMessage.includes('not found')) {
          return createError(
            'element_not_found',
            `Option not found in ${input.ref}.`,
            'Take a snapshot and check available options in the select element.',
          );
        }

        // Timeout
        if (errorMessage.includes('Timeout')) {
          return createError('timeout', `Selection on ${input.ref} timed out.`, 'Element may be loading. Try again.');
        }

        return createError('browser_error', `Selection failed: ${errorMessage}`);
      }
    },
  });
}
