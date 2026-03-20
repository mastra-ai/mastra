import type { GetHtmlOutput } from '@mastra/core/browser';
import { createError, getHtmlInputSchema, getHtmlOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createGetHtmlTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_html',
    description: 'Get HTML content of an element or the entire page',
    inputSchema: getHtmlInputSchema,
    outputSchema: getHtmlOutputSchema,
    execute: async ({ context: { ref, outer = true } }): Promise<GetHtmlOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        let html: string;

        if (ref) {
          const locator = browser.getLocatorFromRef(ref);
          if (!locator) {
            return createError('stale_ref', `Element ref ${ref} is no longer valid. Take a new snapshot.`);
          }

          if (outer) {
            html = await locator.evaluate((el: Element) => el.outerHTML);
          } else {
            html = await locator.evaluate((el: Element) => el.innerHTML);
          }
        } else {
          // Get full page HTML
          html = await page.content();
        }

        return {
          success: true,
          html,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'get_html_failed',
          message: `Failed to get HTML: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}
