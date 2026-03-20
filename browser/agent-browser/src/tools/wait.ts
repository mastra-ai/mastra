import type { BrowserToolError, WaitOutput } from '@mastra/core/browser';
import { waitInputSchema, waitOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a wait tool that waits for a specified time or element state.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for waiting
 */
export function createWaitTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_wait',
    description:
      'Wait for a specified time (milliseconds) or for an element to reach a state (visible, hidden, attached, detached).',
    inputSchema: waitInputSchema,
    outputSchema: waitOutputSchema,
    execute: async (input): Promise<WaitOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const page = browser.getPage();

      try {
        // If waiting for time
        if (input.milliseconds !== undefined && !input.ref) {
          await page.waitForTimeout(input.milliseconds);
          return {
            success: true,
            url: page.url(),
            hint: 'Wait completed. Take a snapshot to see current page state.',
          };
        }

        // If waiting for element
        if (input.ref) {
          const locator = browser.getLocatorFromRef(input.ref);

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

          await locator.waitFor({
            state: input.state ?? 'visible',
            timeout: input.milliseconds ?? defaultTimeout,
          });

          return {
            success: true,
            url: page.url(),
            hint: `Element is now ${input.state ?? 'visible'}. Take a snapshot to see current state.`,
          };
        }

        // Neither specified
        return {
          success: false,
          code: 'invalid_input',
          message: 'Must specify either milliseconds or ref (or both).',
          url: page.url(),
          canRetry: false,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Wait timed out. Element did not reach ${input.state ?? 'visible'} state.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Wait failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
