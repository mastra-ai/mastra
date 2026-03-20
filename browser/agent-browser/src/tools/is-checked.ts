import type { IsCheckedOutput } from '@mastra/core/browser';
import { isCheckedInputSchema, isCheckedOutputSchema, ErrorCode, BrowserToolError } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createIsCheckedTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_is_checked',
    description: 'Check if a checkbox or radio button is checked.',
    inputSchema: isCheckedInputSchema,
    outputSchema: isCheckedOutputSchema,
    execute: async ({ context }): Promise<IsCheckedOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return {
            success: false,
            code: ErrorCode.STALE_REF,
            message: `Element reference "${ref}" not found. Take a new snapshot.`,
          };
        }

        const checked = await locator.isChecked?.({ timeout: 5000 });
        const page = browser.getPage();

        return {
          success: true,
          checked: checked ?? false,
          url: page.url(),
        };
      } catch (error) {
        if (error instanceof BrowserToolError) {
          return {
            success: false,
            code: error.code,
            message: error.message,
          };
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}
