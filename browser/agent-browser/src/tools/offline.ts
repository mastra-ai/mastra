import type { SetOfflineOutput } from '@mastra/core/browser';
import { setOfflineInputSchema, setOfflineOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSetOfflineTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_offline',
    description: 'Set the browser to offline or online mode.',
    inputSchema: setOfflineInputSchema,
    outputSchema: setOfflineOutputSchema,
    execute: async ({ context }): Promise<SetOfflineOutput> => {
      const { offline } = context;

      try {
        const browser = await getBrowser();
        await browser.setOffline?.(offline);

        return {
          success: true,
          message: offline ? 'Browser is now offline' : 'Browser is now online',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'browser_error',
          message,
        };
      }
    },
  });
}
