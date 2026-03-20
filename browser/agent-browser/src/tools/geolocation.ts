import type { SetGeolocationOutput } from '@mastra/core/browser';
import { setGeolocationInputSchema, setGeolocationOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSetGeolocationTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_geolocation',
    description: 'Set the browser geolocation.',
    inputSchema: setGeolocationInputSchema,
    outputSchema: setGeolocationOutputSchema,
    execute: async ({ context }): Promise<SetGeolocationOutput> => {
      const { latitude, longitude, accuracy } = context;

      try {
        const browser = await getBrowser();
        await browser.setGeolocation?.(latitude, longitude, accuracy);

        return {
          success: true,
          message: `Geolocation set to ${latitude}, ${longitude}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'browser_error',
          message,
        };
      }
    },
  });
}
