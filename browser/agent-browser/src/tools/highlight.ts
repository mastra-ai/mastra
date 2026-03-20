import type { HighlightOutput } from '@mastra/core/browser';
import { createError, highlightInputSchema, highlightOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createHighlightTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_highlight',
    description: 'Temporarily highlight an element with a colored border (useful for visual debugging)',
    inputSchema: highlightInputSchema,
    outputSchema: highlightOutputSchema,
    execute: async ({ context: { ref, color = 'red', duration = 2000 } }): Promise<HighlightOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const locator = browser.getLocatorFromRef(ref);
        if (!locator) {
          return createError('stale_ref', `Element ref ${ref} is no longer valid. Take a new snapshot.`);
        }

        // Add highlight style
        await locator.evaluate(
          (el: HTMLElement, { color, duration }: { color: string; duration: number }) => {
            const originalOutline = el.style.outline;
            const originalOutlineOffset = el.style.outlineOffset;

            el.style.outline = `3px solid ${color}`;
            el.style.outlineOffset = '2px';

            setTimeout(() => {
              el.style.outline = originalOutline;
              el.style.outlineOffset = originalOutlineOffset;
            }, duration);
          },
          { color, duration },
        );

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'highlight_failed',
          message: `Failed to highlight element: ${message}`,
        };
      }
    },
  });
}
