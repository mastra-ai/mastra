import type { UncheckOutput } from '@mastra/core/browser';
import { uncheckInputSchema, uncheckOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createUncheckTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_uncheck',
    description: 'Uncheck a checkbox element. Use element references from browser_snapshot.',
    inputSchema: uncheckInputSchema,
    outputSchema: uncheckOutputSchema,
    execute: async ({ context }): Promise<UncheckOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return {
            success: false,
            code: 'stale_ref',
            message: `Element reference "${ref}" not found. Take a new snapshot.`,
            recoveryHint: 'Use browser_snapshot to get current element references.',
            canRetry: false,
          };
        }

        await locator.uncheck?.({ timeout: 5000 });
        const page = browser.getPage();
        const url = page.url();

        return {
          success: true,
          url,
          hint: 'Checkbox unchecked. Take a snapshot to verify.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
          canRetry: true,
        };
      }
    },
  });
}
