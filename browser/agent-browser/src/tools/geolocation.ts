import type { SetGeolocationOutput } from '@mastra/core/browser';
import { setGeolocationInputSchema, setGeolocationOutputSchema, ErrorCode } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createSetGeolocationTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_geolocation',
    description: 'Set the browser geolocation. Useful for testing location-based features.',
    inputSchema: setGeolocationInputSchema,
    outputSchema: setGeolocationOutputSchema,
    execute: async ({ context }): Promise<SetGeolocationOutput> => {
      const { latitude, longitude, accuracy } = context;

      try {
        const browser = await getBrowser();

        if (browser.setGeolocation) {
          await browser.setGeolocation(latitude, longitude, accuracy);
        } else {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Geolocation setting not supported by this browser provider.',
          };
        }

        return {
          success: true,
          latitude,
          longitude,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}
