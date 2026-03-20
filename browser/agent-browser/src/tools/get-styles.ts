import type { GetStylesOutput } from '@mastra/core/browser';
import { getStylesInputSchema, getStylesOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createGetStylesTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_get_styles',
    description: 'Get computed CSS styles for an element. Use element references from browser_snapshot.',
    inputSchema: getStylesInputSchema,
    outputSchema: getStylesOutputSchema,
    execute: async ({ context }): Promise<GetStylesOutput> => {
      const { ref, properties } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);

        if (!locator) {
          return {
            success: false,
            code: 'stale_ref',
            message: `Element reference ${ref} not found. The page may have changed.`,
            recoveryHint: 'Take a new snapshot to get fresh element references.',
            canRetry: false,
          };
        }

        const styles = await locator.evaluate((el: Element, props?: string[]) => {
          const computed = window.getComputedStyle(el);
          const result: Record<string, string> = {};

          if (props && props.length > 0) {
            // Return only requested properties
            for (const prop of props) {
              result[prop] = computed.getPropertyValue(prop);
            }
          } else {
            // Return all computed styles
            for (let i = 0; i < computed.length; i++) {
              const name = computed[i];
              result[name] = computed.getPropertyValue(name);
            }
          }

          return result;
        }, properties);

        return {
          success: true,
          styles,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}
