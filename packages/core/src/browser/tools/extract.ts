/**
 * Browser Extract Tool
 *
 * Handles data extraction from the page:
 * - snapshot: Get accessibility tree with element refs
 * - screenshot: Capture page/element image
 * - text: Get element text content
 * - html: Get element HTML
 * - value: Get input value
 * - attribute: Get element attribute
 * - title: Get page title
 * - url: Get page URL
 * - count: Count matching elements
 * - bounding_box: Get element dimensions
 * - styles: Get computed styles
 * - evaluate: Run JavaScript
 */

import { createTool } from '../../tools';
import { createError } from '../errors';
import { extractInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserExtractTool = createTool({
  id: 'browser_extract',
  description: `Extract data from the page. Actions:
- snapshot: Get accessibility tree with element refs (@e1, @e2, etc.)
- screenshot: Capture page or element image
- text: Get text content of an element
- html: Get HTML of an element
- value: Get value of an input element
- attribute: Get an attribute value
- title: Get page title
- url: Get current URL
- count: Count matching elements
- bounding_box: Get element position and size
- styles: Get computed CSS styles
- evaluate: Run JavaScript in page context`,
  inputSchema: extractInputSchema,
  toModelOutput(output: unknown) {
    // Convert screenshot output to multimodal content for LLMs
    const result = output as Record<string, unknown>;
    if (result?.success && result?.base64 && result?.mimeType) {
      return {
        type: 'content' as const,
        value: [
          {
            type: 'text' as const,
            text: `Screenshot captured (${result.dimensions ? `${(result.dimensions as any).width}x${(result.dimensions as any).height}` : 'unknown size'})`,
          },
          { type: 'media' as const, data: result.base64 as string, mediaType: result.mimeType as string },
        ],
      };
    }
    // For non-screenshot results, return as-is
    return undefined;
  },
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.extract(input as Parameters<typeof browser.extract>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Stale ref
      if (msg.includes('STALE_REF:')) {
        const ref = msg.split('STALE_REF:')[1];
        return createError(
          'stale_ref',
          `Ref ${ref} not found. The page has changed.`,
          'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
        );
      }

      // Timeout
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        return createError(
          'timeout',
          'Extract operation timed out.',
          'Take a new snapshot - the page may still be loading.',
        );
      }

      // Generic error
      return createError(
        'browser_error',
        `Extract failed: ${msg}`,
        'Take a new snapshot to see the current page state.',
      );
    }
  },
});
