// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createThreadFromMessageInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel containing the message. Example: "123456789012345678"'),
  message_id: z.string().describe('The ID of the message to create a thread from. Example: "987654321098765432"'),
  name: z.string().min(1).max(100).describe('The name of the thread (1-100 characters). Example: "Discussion Thread"'),
  auto_archive_duration: z
    .union([z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)])
    .optional()
    .describe('Duration in minutes to automatically archive the thread. One of: 60, 1440, 4320, 10080'),
  rate_limit_per_user: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Seconds to wait between messages (slowmode). Range: 0-21600'),
});

const ProviderThreadSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  name: z.string(),
  last_message_id: z.string().nullable().optional(),
  parent_id: z.string().optional(),
  owner_id: z.string().optional(),
  message_count: z.number().int().optional(),
  member_count: z.number().int().optional(),
  rate_limit_per_user: z.number().int().optional(),
  thread_metadata: z
    .object({
      archived: z.boolean(),
      auto_archive_duration: z.number().int(),
      archive_timestamp: z.string().optional(),
      locked: z.boolean().optional(),
      invitable: z.boolean().optional(),
      create_timestamp: z.string().optional(),
    })
    .optional(),
});

export const createThreadFromMessageOutputSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  name: z.string(),
  last_message_id: z.string().optional(),
  parent_id: z.string().optional(),
  owner_id: z.string().optional(),
  message_count: z.number().int().optional(),
  member_count: z.number().int().optional(),
  rate_limit_per_user: z.number().int().optional(),
  thread_metadata: z
    .object({
      archived: z.boolean(),
      auto_archive_duration: z.number().int(),
      archive_timestamp: z.string().optional(),
      locked: z.boolean().optional(),
      invitable: z.boolean().optional(),
      create_timestamp: z.string().optional(),
    })
    .optional(),
});

export function createThreadFromMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_create_thread_from_message',
    description: 'Start a Discord thread from an existing message',
    inputSchema: createThreadFromMessageInputSchema,
    outputSchema: createThreadFromMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createThreadFromMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken || '';

      const requestData: Record<string, unknown> = {
        name: input.name,
      };

      if (input.auto_archive_duration !== undefined) {
        requestData['auto_archive_duration'] = input.auto_archive_duration;
      }

      if (input.rate_limit_per_user !== undefined) {
        requestData['rate_limit_per_user'] = input.rate_limit_per_user;
      }

      // https://discord.com/developers/docs/resources/channel#start-thread-from-message
      const response = await platformProxy.post({
        endpoint: `/api/v10/channels/${input.channel_id}/messages/${input.message_id}/threads`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        data: requestData,
        retries: 1,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to create thread from message',
          channel_id: input.channel_id,
          message_id: input.message_id,
        });
      }

      const providerThread = ProviderThreadSchema.parse(response.data);

      return {
        id: providerThread.id,
        type: providerThread.type,
        ...(providerThread.guild_id !== undefined && { guild_id: providerThread.guild_id }),
        name: providerThread.name,
        ...(providerThread.last_message_id != null && { last_message_id: providerThread.last_message_id }),
        ...(providerThread.parent_id !== undefined && { parent_id: providerThread.parent_id }),
        ...(providerThread.owner_id !== undefined && { owner_id: providerThread.owner_id }),
        ...(providerThread.message_count !== undefined && { message_count: providerThread.message_count }),
        ...(providerThread.member_count !== undefined && { member_count: providerThread.member_count }),
        ...(providerThread.rate_limit_per_user !== undefined && {
          rate_limit_per_user: providerThread.rate_limit_per_user,
        }),
        ...(providerThread.thread_metadata !== undefined && {
          thread_metadata: {
            archived: providerThread.thread_metadata.archived,
            auto_archive_duration: providerThread.thread_metadata.auto_archive_duration,
            ...(providerThread.thread_metadata.archive_timestamp !== undefined && {
              archive_timestamp: providerThread.thread_metadata.archive_timestamp,
            }),
            ...(providerThread.thread_metadata.locked !== undefined && {
              locked: providerThread.thread_metadata.locked,
            }),
            ...(providerThread.thread_metadata.invitable !== undefined && {
              invitable: providerThread.thread_metadata.invitable,
            }),
            ...(providerThread.thread_metadata.create_timestamp !== undefined && {
              create_timestamp: providerThread.thread_metadata.create_timestamp,
            }),
          },
        }),
      };
    },
  });
}
