// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const stopWatchInputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe(
      'The user\'s email address. Use "me" to indicate the authenticated user. Defaults to "me". Example: "me"',
    ),
});

export const stopWatchOutputSchema = z.object({
  success: z.boolean(),
});

export function stopWatchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_stop_watch',
    description: 'Stop Gmail push notification watch state for the mailbox.',
    inputSchema: stopWatchInputSchema,
    outputSchema: stopWatchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof stopWatchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/stop
      await platformProxy.post({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/stop`,
        retries: 3,
      });

      return { success: true };
    },
  });
}
