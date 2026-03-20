import type { SetCredentialsOutput } from '@mastra/core/browser';
import { setCredentialsInputSchema, setCredentialsOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSetCredentialsTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_credentials',
    description: 'Set HTTP basic authentication credentials for the browser context.',
    inputSchema: setCredentialsInputSchema,
    outputSchema: setCredentialsOutputSchema,
    execute: async ({ context }): Promise<SetCredentialsOutput> => {
      const { username, password } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();
        const browserContext = page.context();

        await browserContext.setHTTPCredentials({ username, password });

        return {
          success: true,
          message: `HTTP credentials set for user "${username}"`,
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
