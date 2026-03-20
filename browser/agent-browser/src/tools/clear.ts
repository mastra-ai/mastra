import type { ClearOutput } from '@mastra/core/browser';
import { clearInputSchema, clearOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clear',
    description: 'Clear text from an input element. Use element references from browser_snapshot.',
    inputSchema: clearInputSchema,
    outputSchema: clearOutputSchema,
    execute: async ({ context }): Promise<ClearOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);

        if (!locator) {
          return {
            success: false,
            code: 'stale_ref',
            message: `Element reference ${ref} not found. The page may have changed.`,
            recoveryHint: 'Take a new snapshot to get fresh element references.',
            canRetry: false,
          };
        }

        await locator.clear();

        return {
          success: true,
          message: `Cleared input ${ref}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}
