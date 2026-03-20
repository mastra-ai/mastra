import type { GetUrlOutput } from '@mastra/core/browser';
import { getUrlInputSchema, getUrlOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetUrlTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_url',
    description: 'Get the current page URL.',
    inputSchema: getUrlInputSchema,
    outputSchema: getUrlOutputSchema,
    execute: async (): Promise<GetUrlOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();
        const url = page.url();

        return {
          success: true,
          url,
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
