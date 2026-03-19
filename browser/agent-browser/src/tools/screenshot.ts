import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { screenshotInputSchema, screenshotOutputSchema } from '@mastra/core/browser';
import type { ScreenshotOutput } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Maximum dimension (width or height) before emitting a warning.
 * Images exceeding 8000px may be rejected by some multimodal APIs.
 */
const MAX_DIMENSION = 8000;

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
 */
export function createScreenshotTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_screenshot',
    description: 'Capture a screenshot of the current page or a specific element.',
    inputSchema: screenshotInputSchema,
    outputSchema: screenshotOutputSchema,
    toModelOutput(output: ScreenshotOutput) {
      if (!output.success || !output.base64) return undefined;
      return {
        type: 'content' as const,
        value: [
          { type: 'text' as const, text: output.message },
          { type: 'media' as const, data: output.base64, mediaType: output.mimeType },
        ],
      };
    },
    execute: async (input): Promise<ScreenshotOutput> => {
      const browser = await getBrowser();
      const page = browser.getPage();

      const makeError = (code: string, message: string, recoveryHint?: string): ScreenshotOutput => ({
        success: false,
        message,
        mimeType: 'image/png',
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
        timestamp: new Date().toISOString(),
        url: '',
        title: '',
        code,
        recoveryHint,
        canRetry: code === 'stale_ref' || code === 'timeout',
      });

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
            return makeError(
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
          dimensions = box ? { width: Math.round(box.width), height: Math.round(box.height) } : { width: 0, height: 0 };
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

        // Save screenshot to screenshots folder in cwd
        const screenshotsDir = join(process.cwd(), 'screenshots');
        await mkdir(screenshotsDir, { recursive: true });

        // Generate unique filename using timestamp
        const ext = format || 'png';
        const filename = `screenshot-${Date.now()}.${ext}`;
        const filePath = join(screenshotsDir, filename);
        await writeFile(filePath, buffer);

        // Build descriptive message about what was captured
        const captureType = input.ref ? `element ${input.ref}` : input.fullPage ? 'full page' : 'viewport';
        const message = `Screenshot captured: ${captureType} (${dimensions.width}x${dimensions.height}px, ${Math.round(buffer.length / 1024)}KB ${ext.toUpperCase()})`;

        return {
          success: true,
          message,
          base64: buffer.toString('base64'),
          path: filePath,
          publicPath: `/screenshots/${filename}`,
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
          return makeError(
            'timeout',
            'Screenshot capture timed out after 30 seconds.',
            'Try capturing viewport only (fullPage: false) or a specific element.',
          );
        }

        // Generic browser error
        return makeError('browser_error', `Screenshot failed: ${message}`);
      }
    },
  });
}
