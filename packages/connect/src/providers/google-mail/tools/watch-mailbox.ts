// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const watchMailboxInputSchema = z.object({
  topicName: z
    .string()
    .describe(
      'The name of the Cloud Pub/Sub topic to use for notifications. Format: projects/{project}/topics/{topic}',
    ),
  labelIds: z
    .array(z.string())
    .optional()
    .describe(
      'List of label IDs to filter on for push notifications. If specified, only changes to messages with these labels will trigger notifications.',
    ),
  labelFilterBehavior: z
    .enum(['include', 'exclude'])
    .optional()
    .describe(
      'How to treat the labelIds filter. "include" means only labels in labelIds will trigger notifications. "exclude" means all labels except those in labelIds will trigger notifications.',
    ),
});

const ProviderWatchResponseSchema = z.object({
  historyId: z.string().describe('The ID of the mailbox history record at which the watch was started.'),
  expiration: z.string().describe('The expiration time of the watch as a timestamp in milliseconds.'),
});

export const watchMailboxOutputSchema = z.object({
  historyId: z.string().describe('The ID of the mailbox history record at which the watch was started.'),
  expiration: z.string().describe('The expiration time of the watch as a timestamp in milliseconds.'),
});

export function watchMailboxTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_watch_mailbox',
    description: 'Start Gmail push notifications for mailbox changes.',
    inputSchema: watchMailboxInputSchema,
    outputSchema: watchMailboxOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof watchMailboxOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
      const response = await platformProxy.post({
        endpoint: '/gmail/v1/users/me/watch',
        data: {
          topicName: input.topicName,
          ...(input.labelIds !== undefined && { labelIds: input.labelIds }),
          ...(input.labelFilterBehavior !== undefined && { labelFilterBehavior: input.labelFilterBehavior }),
        },
        retries: 3,
      });

      const watchResponse = ProviderWatchResponseSchema.parse(response.data);

      return {
        historyId: watchResponse.historyId,
        expiration: watchResponse.expiration,
      };
    },
  });
}
