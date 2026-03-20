import type { TapOutput } from '@mastra/core/browser';
import { tapInputSchema, tapOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createTapTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_tap',
    description: 'Tap an element (touch event for mobile emulation). Use element references from browser_snapshot.',
    inputSchema: tapInputSchema,
    outputSchema: tapOutputSchema,
    execute: async ({ context }): Promise<TapOutput> => {
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

        await locator.tap();

        return {
          success: true,
          message: `Tapped ${ref}`,
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
