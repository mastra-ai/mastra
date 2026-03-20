import type { SetHeadersOutput } from '@mastra/core/browser';
import { setHeadersInputSchema, setHeadersOutputSchema, ErrorCode } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createSetHeadersTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_headers',
    description: 'Set extra HTTP headers for all requests. Optionally scope to a specific origin.',
    inputSchema: setHeadersInputSchema,
    outputSchema: setHeadersOutputSchema,
    execute: async ({ context }): Promise<SetHeadersOutput> => {
      const { headers, origin } = context;

      try {
        const browser = await getBrowser();

        if (origin && browser.setScopedHeaders) {
          await browser.setScopedHeaders(origin, headers);
        } else if (browser.setExtraHeaders) {
          await browser.setExtraHeaders(headers);
        } else {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Header setting not supported by this browser provider.',
          };
        }

        return {
          success: true,
          headerCount: Object.keys(headers).length,
          scoped: !!origin,
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
