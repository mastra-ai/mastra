import { createTool } from '@mastra/core/tools';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { createError, type BrowserToolError } from '../errors.js';
import { navigateInputSchema, navigateOutputSchema, type NavigateOutput } from '../types.js';

/**
 * Creates a navigate tool that uses the BrowserManager to navigate to URLs.
 *
 * The tool uses Playwright's page.goto() under the hood, with configurable
 * waitUntil conditions and timeout handling.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance (lazy initialization)
 * @param defaultTimeout - Default timeout in milliseconds for navigation
 * @returns A Mastra tool for browser navigation
 */
export function createNavigateTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_navigate',
    description: 'Navigate the browser to a URL. Returns the final URL and page title after navigation completes.',
    inputSchema: navigateInputSchema,
    outputSchema: navigateOutputSchema,
    execute: async (input, context): Promise<NavigateOutput | BrowserToolError> => {
      const timeoutMs = defaultTimeout;

      try {
        const browser = await getBrowser();

        // Create timeout controller for cancellation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Link to context.abortSignal if provided (agent cancellation)
        if (context.abortSignal) {
          context.abortSignal.addEventListener('abort', () => controller.abort());
        }

        try {
          // Get the Playwright page from BrowserManager
          const page = browser.getPage();

          // Navigate using Playwright's page.goto()
          // waitUntil defaults to 'domcontentloaded' for faster results
          await page.goto(input.url, {
            timeout: timeoutMs,
            waitUntil: input.waitUntil || 'domcontentloaded',
          });

          // Get page info after navigation
          const url = page.url();
          const title = await page.title();

          return {
            success: true,
            url,
            title,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // Return LLM-friendly error with recovery hints using unified error format
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('aborted');
        const isNotLaunched = errorMessage.includes('not launched') || errorMessage.includes('Browser is not launched');

        if (isTimeout) {
          return createError('timeout', 'Navigation timed out', 'Try a different URL or increase timeout');
        } else if (isNotLaunched) {
          return createError('browser_error', 'Browser was not initialized', 'This is an internal error - please try again');
        } else {
          return createError('browser_error', `Navigation failed: ${errorMessage}`, 'Check that the URL is valid and the site is accessible');
        }
      }
    },
  });
}
