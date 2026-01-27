import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { type BrowserToolError, createError } from '../errors.js';

/**
 * Maximum dimension (width or height) before emitting a warning.
 * Images exceeding 8000px may be rejected by some multimodal APIs.
 */
const MAX_DIMENSION = 8000;

/**
 * Zod schema for screenshot tool input parameters.
 */
const screenshotInputSchema = z.object({
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe('Capture the entire scrollable page instead of just the viewport'),
  format: z
    .enum(['png', 'jpeg'])
    .optional()
    .default('png')
    .describe('Image format. PNG is lossless, JPEG is smaller.'),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(80)
    .describe('JPEG quality (0-100). Ignored for PNG.'),
  ref: z.string().optional().describe('Element ref from snapshot to capture specific element (e.g., @e5)'),
});

/**
 * Zod schema for screenshot tool output.
 */
const screenshotOutputSchema = z.object({
  base64: z.string().describe('Base64-encoded image data'),
  mimeType: z.enum(['image/png', 'image/jpeg']).describe('Image MIME type'),
  dimensions: z
    .object({
      width: z.number().describe('Image width in pixels'),
      height: z.number().describe('Image height in pixels'),
    })
    .describe('Image dimensions'),
  fileSize: z.number().describe('Image file size in bytes'),
  timestamp: z.string().describe('ISO timestamp when screenshot was captured'),
  url: z.string().describe('Page URL at capture time'),
  title: z.string().describe('Page title at capture time'),
  warning: z.string().optional().describe('Warning message if image dimensions exceed recommended limits'),
});

/**
 * Input type for the screenshot tool.
 */
export type ScreenshotInput = z.infer<typeof screenshotInputSchema>;

/**
 * Output type for the screenshot tool.
 */
export type ScreenshotOutput = z.infer<typeof screenshotOutputSchema>;

/**
 * Creates a screenshot tool that captures images of the current page or specific elements.
 *
 * Supports three capture modes:
 * - Viewport (default): Captures the currently visible area
 * - Full-page: Captures the entire scrollable page
 * - Element: Captures a specific element by ref from snapshot
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for screenshot operations
 * @returns A Mastra tool for capturing screenshots
 *
 * @example
 * ```typescript
 * const screenshotTool = createScreenshotTool(() => browserManager, 30000);
 *
 * // Viewport screenshot
 * await screenshotTool.execute({});
 *
 * // Full-page screenshot
 * await screenshotTool.execute({ fullPage: true });
 *
 * // Element screenshot
 * await screenshotTool.execute({ ref: '@e5' });
 *
 * // JPEG with quality
 * await screenshotTool.execute({ format: 'jpeg', quality: 90 });
 * ```
 */
export function createScreenshotTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_screenshot',
    description: 'Capture a screenshot of the current page or a specific element.',
    inputSchema: screenshotInputSchema,
    outputSchema: screenshotOutputSchema,
    execute: async (input): Promise<ScreenshotOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const page = browser.getPage();

      try {
        const timestamp = new Date().toISOString();
        const url = page.url();
        const title = await page.title();

        let buffer: Buffer;
        let dimensions: { width: number; height: number };

        // Determine the image format and MIME type
        const format = input.format;
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

        // Element screenshot mode
        if (input.ref) {
          const locator = browser.getLocatorFromRef(input.ref);

          if (!locator) {
            return createError(
              'stale_ref',
              `Element ${input.ref} not found. The page may have changed.`,
              'Take a new snapshot to get current element refs.',
            );
          }

          // Capture element screenshot (auto-scrolls into view)
          buffer = await locator.screenshot({
            type: format,
            timeout: defaultTimeout,
          });

          // Get element bounding box for dimensions
          const box = await locator.boundingBox();
          dimensions = box
            ? { width: Math.round(box.width), height: Math.round(box.height) }
            : { width: 0, height: 0 };
        }
        // Full-page screenshot mode
        else if (input.fullPage) {
          // Get full-page dimensions before capture
          // Using string evaluation to avoid TypeScript DOM type issues
          dimensions = (await page.evaluate(
            '({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })',
          )) as { width: number; height: number };

          buffer = await page.screenshot({
            fullPage: true,
            type: format,
            quality: format === 'jpeg' ? input.quality : undefined,
            timeout: defaultTimeout,
          });
        }
        // Viewport screenshot mode (default)
        else {
          const viewport = page.viewportSize();
          dimensions = viewport ? { width: viewport.width, height: viewport.height } : { width: 0, height: 0 };

          buffer = await page.screenshot({
            type: format,
            quality: format === 'jpeg' ? input.quality : undefined,
            timeout: defaultTimeout,
          });
        }

        // Check for oversized images
        const isOversized = dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION;
        const warning = isOversized
          ? `Image dimensions (${dimensions.width}x${dimensions.height}) exceed recommended ${MAX_DIMENSION}px limit. Some APIs may reject this image.`
          : undefined;

        return {
          base64: buffer.toString('base64'),
          mimeType,
          dimensions,
          fileSize: buffer.length,
          timestamp,
          url,
          title,
          warning,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Operation timed out
        if (message.includes('Timeout')) {
          return createError(
            'timeout',
            'Screenshot capture timed out after 30 seconds.',
            'Try capturing viewport only (fullPage: false) or a specific element.',
          );
        }

        // Generic browser error
        return createError('browser_error', `Screenshot failed: ${message}`);
      }
    },
  });
}
