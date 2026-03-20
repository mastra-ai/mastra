import type { IsEnabledOutput } from '@mastra/core/browser';
import { isEnabledInputSchema, isEnabledOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createIsEnabledTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_is_enabled',
    description: 'Check if an element is enabled (not disabled).',
    inputSchema: isEnabledInputSchema,
    outputSchema: isEnabledOutputSchema,
    execute: async ({ context }): Promise<IsEnabledOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return {
            success: false,
            code: 'stale_ref',
            message: `Element reference "${ref}" not found. Take a new snapshot.`,
          };
        }

        // Check if element is enabled via evaluate
        const enabled = await locator.evaluate((el: Element) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLSelectElement) {
            return !el.disabled;
          }
          return !el.hasAttribute('disabled');
        });

        const page = browser.getPage();

        return {
          success: true,
          enabled: enabled as boolean,
          url: page.url(),
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
