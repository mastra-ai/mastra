// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChannelInputSchema = z.object({
  channel_id: z.string().describe('The unique identifier of the channel to fetch. Example: "channel-id-1"'),
});

const ChannelMemberSchema = z.object({
  user_id: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
});

const ProviderChannelSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  is_private: z.boolean().nullish(),
  created_by: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  members: z.array(ChannelMemberSchema).nullish(),
});

export const getChannelOutputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  is_private: z.boolean().optional(),
  created_by: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  members: z.array(ChannelMemberSchema).optional(),
});

export function getChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_get_channel',
    description: 'Retrieve a specific channel by ID.',
    inputSchema: getChannelInputSchema,
    outputSchema: getChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/channel
        endpoint: '/graphql',
        data: {
          query: `query Channel($channelId: ID!) {
                    channel(id: $channelId) {
                        id
                        title
                        is_private
                        created_by
                        created_at
                        updated_at
                        members {
                            user_id
                            email
                            name
                        }
                    }
                }`,
          variables: {
            channelId: input.channel_id,
          },
        },
        retries: 3,
      });

      if (!response.data || !response.data.data || !response.data.data.channel) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Channel not found or you do not have access to it.',
          channel_id: input.channel_id,
        });
      }

      const providerChannel = ProviderChannelSchema.parse(response.data.data.channel);

      return {
        id: providerChannel.id,
        ...(providerChannel.title != null && { title: providerChannel.title }),
        ...(providerChannel.is_private != null && { is_private: providerChannel.is_private }),
        ...(providerChannel.created_by != null && { created_by: providerChannel.created_by }),
        ...(providerChannel.created_at != null && { created_at: providerChannel.created_at }),
        ...(providerChannel.updated_at != null && { updated_at: providerChannel.updated_at }),
        ...(providerChannel.members != null && { members: providerChannel.members }),
      };
    },
  });
}
