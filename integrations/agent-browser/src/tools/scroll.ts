import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError, createError } from '../errors.js';

/**
 * Zod schema for scroll tool input parameters.
 */
const scrollInputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
  amount: z
    .union([z.enum(['page', 'half']), z.number().describe('Pixels to scroll')])
    .optional()
    .default('page')
    .describe('Amount to scroll: "page", "half", or number of pixels'),
  ref: z.string().optional().describe('Element ref to scroll within (omit for viewport scroll)'),
});

/**
 * Zod schema for scroll tool output.
 */
const scrollOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll operation succeeded'),
  position: z
    .object({
      x: z.number().describe('Horizontal scroll position in pixels'),
      y: z.number().describe('Vertical scroll position in pixels'),
    })
    .describe('New scroll position after scrolling'),
});

/**
 * Input type for the scroll tool.
 */
export type ScrollInput = z.infer<typeof scrollInputSchema>;

/**
 * Output type for the scroll tool.
 */
export type ScrollOutput = z.infer<typeof scrollOutputSchema>;

/**
 * Creates a scroll tool that scrolls the page viewport or an element.
 *
 * The tool supports four directions (up, down, left, right) and three amount modes:
 * - "page": Full viewport height/width scroll
 * - "half": Half viewport height/width scroll
 * - number: Specific pixel amount
 *
 * If a ref is provided, scrolls within that element instead of the viewport.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for scrolling the page or elements
 *
 * @example
 * ```typescript
 * const scrollTool = createScrollTool(() => browserManager);
 * // Scroll viewport down one page
 * await scrollTool.execute({ direction: 'down' });
 * // Scroll element by 200 pixels
 * await scrollTool.execute({ direction: 'down', amount: 200, ref: '@e5' });
 * ```
 */
export function createScrollTool(getBrowser: () => Promise<BrowserManager>) {
  return createTool({
    id: 'browser_scroll',
    description: 'Scroll the page viewport or an element in a direction.',
    inputSchema: scrollInputSchema,
    outputSchema: scrollOutputSchema,
    execute: async (input): Promise<ScrollOutput | BrowserToolError> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        // Get viewport size for calculating page/half scroll amounts
        const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

        // Calculate scroll amount in pixels
        let pixels: number;
        if (typeof input.amount === 'number') {
          pixels = input.amount;
        } else if (input.amount === 'half') {
          pixels = Math.floor(viewport.height / 2);
        } else {
          // 'page' is the default
          pixels = viewport.height;
        }

        // Calculate delta based on direction
        let deltaX = 0;
        let deltaY = 0;
        switch (input.direction) {
          case 'up':
            deltaY = -pixels;
            break;
          case 'down':
            deltaY = pixels;
            break;
          case 'left':
            deltaX = -pixels;
            break;
          case 'right':
            deltaX = pixels;
            break;
        }

        if (input.ref) {
          // Scroll within a specific element
          const locator = browser.getLocatorFromRef(input.ref);

          if (!locator) {
            return createError(
              'stale_ref',
              `Ref ${input.ref} not found. The page may have changed.`,
              'Take a new snapshot to get current element refs.',
            );
          }

          // Scroll the element
          await locator.evaluate(
            (el, { dx, dy }) => {
              el.scrollBy(dx, dy);
            },
            { dx: deltaX, dy: deltaY },
          );
        } else {
          // Scroll the viewport
          await page.evaluate(`window.scrollBy(${deltaX}, ${deltaY})`);
        }

        // Get new scroll position (always returns viewport position)
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const position = (await page.evaluate('({ x: Math.round(window.scrollX), y: Math.round(window.scrollY) })')) as {
          x: number;
          y: number;
        };

        return { success: true, position };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createError('browser_error', `Scroll failed: ${message}`);
      }
    },
  });
}
