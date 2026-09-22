// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChannelInfoInputSchema = z.object({
  channel_id: z.string().describe('Slack channel ID to retrieve information about. Example: "C012AB3CD"'),
});

export const getChannelInfoOutputSchema = z.object({
  id: z.string().describe('Channel ID'),
  name: z.string().optional().describe('Channel name'),
  topic: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional()
    .describe('Channel topic information'),
  purpose: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional()
    .describe('Channel purpose information'),
  is_channel: z.boolean().describe('Whether this is a public channel'),
  is_group: z.boolean().describe('Whether this is a private channel'),
  is_im: z.boolean().describe('Whether this is a direct message'),
  is_mpim: z.boolean().describe('Whether this is a multi-person direct message'),
  is_private: z.boolean().describe('Whether the conversation is private'),
  is_archived: z.boolean().describe('Whether the channel is archived'),
  is_general: z.boolean().optional().describe('Whether this is the general channel'),
  created: z.number().describe('Unix timestamp when the channel was created'),
  creator: z.string().optional().describe('User ID of the channel creator'),
  num_members: z.number().optional().describe('Number of members in the channel (if available)'),
  context_team_id: z.string().optional().describe('Team ID for the conversation'),
});

export function getChannelInfoTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_channel_info',
    description: 'Retrieve conversation details including topic, purpose, and membership state',
    inputSchema: getChannelInfoInputSchema,
    outputSchema: getChannelInfoOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChannelInfoOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://api.slack.com/methods/conversations.info
        endpoint: 'conversations.info',
        params: {
          channel: input.channel_id,
          include_num_members: 'true',
        },
        retries: 3,
      });

      if (!response.data || response.data.ok === false) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to retrieve channel information',
          channel_id: input.channel_id,
        });
      }

      const channel = response.data.channel;

      return {
        id: channel.id,
        name: channel.name ?? undefined,
        topic: channel.topic ?? undefined,
        purpose: channel.purpose ?? undefined,
        is_channel: channel.is_channel ?? false,
        is_group: channel.is_group ?? false,
        is_im: channel.is_im ?? false,
        is_mpim: channel.is_mpim ?? false,
        is_private: channel.is_private ?? false,
        is_archived: channel.is_archived ?? false,
        is_general: channel.is_general ?? undefined,
        created: channel.created ?? 0,
        creator: channel.creator ?? undefined,
        num_members: channel.num_members ?? undefined,
        context_team_id: channel.context_team_id ?? undefined,
      };
    },
  });
}
