import type { BrowserToolError, EvaluateOutput } from '@mastra/core/browser';
import { evaluateInputSchema, evaluateOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates an evaluate tool that runs JavaScript in the page context.
 * Useful for complex interactions, extracting data, or manipulating the DOM.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for evaluating JavaScript in the page
 */
export function createEvaluateTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_evaluate',
    description:
      'Evaluate JavaScript in the page context. Returns JSON-serializable results. Use for complex interactions or data extraction.',
    inputSchema: evaluateInputSchema,
    outputSchema: evaluateOutputSchema,
    execute: async (input): Promise<EvaluateOutput | BrowserToolError> => {
      const browser = await getBrowser();

      try {
        const page = browser.getPage();
        const result = await page.evaluate(input.expression);

        return {
          success: true,
          result,
          url: page.url(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const page = browser.getPage();

        if (errorMsg.includes('SyntaxError')) {
          return {
            success: false,
            code: 'syntax_error',
            message: `JavaScript syntax error: ${errorMsg}`,
            url: page.url(),
            canRetry: false,
          };
        }

        if (errorMsg.includes('is not defined') || errorMsg.includes('ReferenceError')) {
          return {
            success: false,
            code: 'reference_error',
            message: `JavaScript reference error: ${errorMsg}`,
            url: page.url(),
            canRetry: false,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Evaluate failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
