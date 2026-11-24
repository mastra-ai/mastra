// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createChannelInputSchema = z.object({
  name: z
    .string()
    .describe(
      'Name of the channel to create. Must be lowercase, contain only letters, numbers, hyphens, and underscores, and be 80 characters or less.',
    ),
  is_private: z
    .boolean()
    .optional()
    .describe('Whether the channel should be private. Defaults to false (public channel).'),
});

export const createChannelOutputSchema = z.object({
  id: z.string().describe('The unique identifier of the channel.'),
  name: z.string().describe('The normalized name of the channel.'),
  is_private: z.boolean().describe('Whether the channel is private.'),
  is_channel: z.boolean().describe('Whether this is a channel.'),
  created: z.number().describe('Unix timestamp when the channel was created.'),
  creator: z.string().describe('User ID of the channel creator.'),
});

export function createChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_create_channel',
    description:
      'Create a new public or private Slack channel by name; does not create DMs or other conversation types.',
    inputSchema: createChannelInputSchema,
    outputSchema: createChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/conversations.create
      const response = await platformProxy.post({
        endpoint: 'conversations.create',
        data: {
          name: input.name,
          is_private: input.is_private ?? false,
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        const error = response.data?.error || 'Unknown error';
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to create conversation: ${error}`,
          error: error,
        });
      }

      const channel = response.data.channel;

      return {
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_channel: channel.is_channel,
        created: channel.created,
        creator: channel.creator,
      };
    },
  });
}
