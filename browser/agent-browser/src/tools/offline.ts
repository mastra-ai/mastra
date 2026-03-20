import type { SetOfflineOutput } from '@mastra/core/browser';
import { setOfflineInputSchema, setOfflineOutputSchema, ErrorCode } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createSetOfflineTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_offline',
    description: 'Enable or disable offline mode. Useful for testing offline behavior.',
    inputSchema: setOfflineInputSchema,
    outputSchema: setOfflineOutputSchema,
    execute: async ({ context }): Promise<SetOfflineOutput> => {
      const { offline } = context;

      try {
        const browser = await getBrowser();

        if (browser.setOffline) {
          await browser.setOffline(offline);
        } else {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Offline mode not supported by this browser provider.',
          };
        }

        return {
          success: true,
          offline,
        };
      } catch (error) {
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
