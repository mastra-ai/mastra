import type { ClearCookiesOutput, GetCookiesOutput, SetCookieOutput } from '@mastra/core/browser';
import {
  clearCookiesInputSchema,
  clearCookiesOutputSchema,
  getCookiesInputSchema,
  getCookiesOutputSchema,
  setCookieInputSchema,
  setCookieOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a getCookies tool that retrieves cookies from the browser context.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for getting cookies
 */
export function createGetCookiesTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_cookies',
    description: 'Get cookies from the browser. Optionally filter by URL(s).',
    inputSchema: getCookiesInputSchema,
    outputSchema: getCookiesOutputSchema,
    execute: async (input): Promise<GetCookiesOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        const context = page.context();
        const urls = input.urls || [page.url()];
        const cookies = await context.cookies(urls);

        return {
          success: true,
          cookies: cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain || '',
            path: c.path || '/',
            expires: c.expires,
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
          })),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        return {
          success: false,
          code: 'browser_error',
          message: `Get cookies failed: ${errorMsg}`,
        };
      }
    },
  });
}

/**
 * Creates a setCookie tool that sets a cookie in the browser context.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for setting cookies
 */
export function createSetCookieTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_cookie',
    description: 'Set a cookie in the browser context.',
    inputSchema: setCookieInputSchema,
    outputSchema: setCookieOutputSchema,
    execute: async (input): Promise<SetCookieOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        const context = page.context();

        await context.addCookies([
          {
            name: input.name,
            value: input.value,
            domain: input.domain,
            path: input.path ?? '/',
            expires: input.expires,
            httpOnly: input.httpOnly ?? false,
            secure: input.secure ?? false,
            sameSite: input.sameSite ?? 'Lax',
          },
        ]);

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        return {
          success: false,
          code: 'browser_error',
          message: `Set cookie failed: ${errorMsg}`,
          url: page.url(),
        };
      }
    },
  });
}

/**
 * Creates a clearCookies tool that clears cookies from the browser context.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for clearing cookies
 */
export function createClearCookiesTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clear_cookies',
    description: 'Clear all cookies from the browser context.',
    inputSchema: clearCookiesInputSchema,
    outputSchema: clearCookiesOutputSchema,
    execute: async (_input): Promise<ClearCookiesOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        const context = page.context();

        // Get count before clearing
        const cookiesBefore = await context.cookies();
        const countBefore = cookiesBefore.length;

        await context.clearCookies();

        return {
          success: true,
          clearedCount: countBefore,
          url: page.url(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        return {
          success: false,
          code: 'browser_error',
          message: `Clear cookies failed: ${errorMsg}`,
          url: page.url(),
        };
      }
    },
  });
}
