import type { BrowserToolError, DragOutput } from '@mastra/core/browser';
import { dragInputSchema, dragOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types.js';

/**
 * Creates a drag tool that drags an element to another element.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @param defaultTimeout - Default timeout in milliseconds for drag operations
 * @returns A Mastra tool for drag-and-drop operations
 */
export function createDragTool(getBrowser: () => Promise<BrowserManagerLike>, defaultTimeout: number) {
  return createTool({
    id: 'browser_drag',
    description: 'Drag an element and drop it onto another element. Both elements must have refs from the snapshot.',
    inputSchema: dragInputSchema,
    outputSchema: dragOutputSchema,
    execute: async (input): Promise<DragOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const sourceLocator = browser.getLocatorFromRef(input.sourceRef);
      const targetLocator = browser.getLocatorFromRef(input.targetRef);

      const page = browser.getPage();

      if (!sourceLocator) {
        return {
          success: false,
          code: 'stale_ref',
          message: `Source ref ${input.sourceRef} not found. The page has changed.`,
          url: page.url(),
          hint: 'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
          canRetry: false,
        };
      }

      if (!targetLocator) {
        return {
          success: false,
          code: 'stale_ref',
          message: `Target ref ${input.targetRef} not found. The page has changed.`,
          url: page.url(),
          hint: 'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
          canRetry: false,
        };
      }

      try {
        await sourceLocator.dragTo(targetLocator, { timeout: defaultTimeout });

        return {
          success: true,
          url: page.url(),
          hint: 'Take a new snapshot to see updated page state after drag.',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Drag operation timed out.`,
            url: page.url(),
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Drag failed: ${errorMsg}`,
          url: page.url(),
          canRetry: false,
        };
      }
    },
  });
}
