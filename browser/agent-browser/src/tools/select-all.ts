import type { SelectAllOutput } from '@mastra/core/browser';
import { selectAllInputSchema, selectAllOutputSchema, ErrorCode, BrowserToolError } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSelectAllTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_select_all',
    description:
      'Select all text in an input or contenteditable element. Use element references from browser_snapshot.',
    inputSchema: selectAllInputSchema,
    outputSchema: selectAllOutputSchema,
    execute: async ({ context }): Promise<SelectAllOutput> => {
      const { ref } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);

        if (!locator) {
          return {
            success: false,
            code: ErrorCode.STALE_REF,
            message: `Element reference ${ref} not found. The page may have changed.`,
            recoveryHint: 'Take a new snapshot to get fresh element references.',
            canRetry: false,
          };
        }

        await locator.selectText();

        return {
          success: true,
          message: `Selected all text in ${ref}`,
        };
      } catch (error) {
        if (error instanceof BrowserToolError) {
          return {
            success: false,
            code: error.code,
            message: error.message,
            recoveryHint: error.recoveryHint,
            canRetry: error.canRetry,
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
