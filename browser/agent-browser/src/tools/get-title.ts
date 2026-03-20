import type { GetTitleOutput } from '@mastra/core/browser';
import { getTitleInputSchema, getTitleOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetTitleTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_title',
    description: 'Get the current page title.',
    inputSchema: getTitleInputSchema,
    outputSchema: getTitleOutputSchema,
    execute: async (): Promise<GetTitleOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();
        const title = await page.title();
        const url = page.url();

        return {
          success: true,
          title,
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
