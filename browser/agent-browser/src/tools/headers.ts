import type { SetHeadersOutput } from '@mastra/core/browser';
import { setHeadersInputSchema, setHeadersOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSetHeadersTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_headers',
    description: 'Set extra HTTP headers for all requests.',
    inputSchema: setHeadersInputSchema,
    outputSchema: setHeadersOutputSchema,
    execute: async ({ context }): Promise<SetHeadersOutput> => {
      const { headers, origin } = context;

      try {
        const browser = await getBrowser();

        if (origin) {
          await browser.setScopedHeaders?.(origin, headers);
        } else {
          await browser.setExtraHeaders?.(headers);
        }

        return {
          success: true,
          message: origin ? `Headers set for ${origin}` : 'Headers set for all requests',
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
