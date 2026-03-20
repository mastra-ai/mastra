import type { GoBackOutput, GoForwardOutput, ReloadOutput } from '@mastra/core/browser';
import {
  goBackInputSchema,
  goBackOutputSchema,
  goForwardInputSchema,
  goForwardOutputSchema,
  reloadInputSchema,
  reloadOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a goBack tool that navigates to the previous page in history.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for navigating back
 */
export function createGoBackTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_go_back',
    description: 'Navigate to the previous page in browser history.',
    inputSchema: goBackInputSchema,
    outputSchema: goBackOutputSchema,
    execute: async (input): Promise<GoBackOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        await page.goBack({
          timeout: defaultTimeout,
          waitUntil: input.waitUntil,
        });

        const url = page.url();
        const title = await page.title();

        return {
          success: true,
          url,
          title,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('no history')) {
          return {
            success: false,
            code: 'no_history',
            message: 'Cannot go back - no previous page in history.',
            url: page.url(),
            canRetry: false,
          };
        }

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: 'Navigation back timed out.',
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Go back failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}

/**
 * Creates a goForward tool that navigates to the next page in history.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for navigating forward
 */
export function createGoForwardTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_go_forward',
    description: 'Navigate to the next page in browser history.',
    inputSchema: goForwardInputSchema,
    outputSchema: goForwardOutputSchema,
    execute: async (input): Promise<GoForwardOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        await page.goForward({
          timeout: defaultTimeout,
          waitUntil: input.waitUntil,
        });

        const url = page.url();
        const title = await page.title();

        return {
          success: true,
          url,
          title,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('no history')) {
          return {
            success: false,
            code: 'no_history',
            message: 'Cannot go forward - no next page in history.',
            url: page.url(),
            canRetry: false,
          };
        }

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: 'Navigation forward timed out.',
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Go forward failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}

/**
 * Creates a reload tool that refreshes the current page.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds
 * @returns A Mastra tool for reloading the page
 */
export function createReloadTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_reload',
    description: 'Reload the current page.',
    inputSchema: reloadInputSchema,
    outputSchema: reloadOutputSchema,
    execute: async (input): Promise<ReloadOutput> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        await page.reload({
          timeout: defaultTimeout,
          waitUntil: input.waitUntil,
        });

        const url = page.url();
        const title = await page.title();

        return {
          success: true,
          url,
          title,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: 'Reload timed out.',
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Reload failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
