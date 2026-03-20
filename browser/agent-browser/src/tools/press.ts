import type { BrowserToolError, PressOutput } from '@mastra/core/browser';
import { pressInputSchema, pressOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a keyboard press tool that presses keys or key combinations.
 * Supports special keys (Enter, Tab, Escape) and combinations (Control+a, Shift+Enter).
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for pressing keyboard keys
 */
export function createPressTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_press',
    description:
      'Press a keyboard key or combination. Supports Enter, Tab, Escape, ArrowDown, Control+a, Shift+Enter, etc.',
    inputSchema: pressInputSchema,
    outputSchema: pressOutputSchema,
    execute: async (input): Promise<PressOutput | BrowserToolError> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        await page.keyboard.press(input.key);

        return {
          success: true,
          url: page.url(),
          hint: 'Take a new snapshot to see updated page state.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Unknown key')) {
          return {
            success: false,
            code: 'invalid_key',
            message: `Unknown key: ${input.key}. Use standard key names like Enter, Tab, Escape, ArrowDown, Control+a.`,
            url: page.url(),
            canRetry: false,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Key press failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
