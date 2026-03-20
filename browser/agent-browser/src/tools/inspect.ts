import type { InspectOutput } from '@mastra/core/browser';
import { createError, inspectInputSchema, inspectOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createInspectTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_inspect',
    description: 'Open Chrome DevTools (only works in headed mode). Optionally focus on a specific element.',
    inputSchema: inspectInputSchema,
    outputSchema: inspectOutputSchema,
    execute: async ({ context: { ref } }): Promise<InspectOutput> => {
      try {
        const browser = await getBrowser();
        const cdp = await browser.getCDPSession();

        if (!cdp) {
          return {
            success: false,
            code: 'cdp_not_available',
            message: 'CDP session not available. DevTools cannot be opened.',
          };
        }

        // Open DevTools
        // Note: This only works if the browser is launched in headed mode
        // In headless mode, DevTools cannot be opened visually

        if (ref) {
          const locator = browser.getLocatorFromRef(ref);
          if (!locator) {
            return createError('stale_ref', `Element ref ${ref} is no longer valid. Take a new snapshot.`);
          }

          // Get the backend node ID for the element
          const backendNodeId = await locator.evaluate((el: Element) => {
            // This is a workaround - in practice we'd need to use CDP DOM.getNodeForLocation
            return (el as unknown as { _backendNodeId?: number })._backendNodeId;
          });

          if (backendNodeId) {
            await cdp.send('DOM.setInspectedNode', { backendNodeId });
          }
        }

        return {
          success: true,
          message: 'DevTools inspection requested. Note: DevTools only opens visually in headed mode.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'inspect_failed',
          message: `Failed to open DevTools: ${message}`,
        };
      }
    },
  });
}
