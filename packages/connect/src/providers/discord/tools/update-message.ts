// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateMessageInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel containing the message. Example: "1504383343142240278"'),
  message_id: z.string().describe('The ID of the message to update. Example: "1504385053805908058"'),
  content: z.string().optional().describe('Message contents (up to 2000 characters).'),
  embeds: z.array(z.object({}).passthrough()).optional().describe('Up to 10 embed objects.'),
  flags: z.number().optional().describe('Message flags (SUPPRESS_EMBEDS and IS_COMPONENTS_V2 only).'),
  allowed_mentions: z.object({}).passthrough().optional().describe('Allowed mentions object.'),
  components: z.array(z.object({}).passthrough()).optional().describe('Message components.'),
  attachments: z
    .array(z.object({}).passthrough())
    .optional()
    .describe('Attachments to retain on the message after edit.'),
});

const ProviderAuthorSchema = z
  .object({
    id: z.string(),
    username: z.string().optional(),
    bot: z.boolean().optional(),
  })
  .passthrough();

const ProviderMessageSchema = z
  .object({
    id: z.string(),
    channel_id: z.string(),
    content: z.string().optional(),
    timestamp: z.string().optional(),
    edited_timestamp: z.string().nullable().optional(),
    author: ProviderAuthorSchema.optional(),
    embeds: z.array(z.object({}).passthrough()).optional(),
    flags: z.number().optional(),
    components: z.array(z.object({}).passthrough()).optional(),
    attachments: z.array(z.object({}).passthrough()).optional(),
  })
  .passthrough();

export const updateMessageOutputSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  content: z.string().optional(),
  timestamp: z.string().optional(),
  edited_timestamp: z.string().optional(),
  author_id: z.string().optional(),
  author_username: z.string().optional(),
  author_bot: z.boolean().optional(),
  embeds: z.array(z.object({}).passthrough()).optional(),
  flags: z.number().optional(),
  components: z.array(z.object({}).passthrough()).optional(),
  attachments: z.array(z.object({}).passthrough()).optional(),
});

export function updateMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_message',
    description: 'Update a message in Discord.',
    inputSchema: updateMessageInputSchema,
    outputSchema: updateMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata();

      const MetadataSchema = z.object({
        botToken: z.string(),
      });

      const parsedMetadata = MetadataSchema.safeParse(metadata);

      if (!parsedMetadata.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      const botToken = parsedMetadata.data.botToken;

      // https://discord.com/developers/docs/resources/message#edit-message
      const response = await platformProxy.patch({
        endpoint: `/api/v10/channels/${input.channel_id}/messages/${input.message_id}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        data: {
          ...(input.content !== undefined && { content: input.content }),
          ...(input.embeds !== undefined && { embeds: input.embeds }),
          ...(input.flags !== undefined && { flags: input.flags }),
          ...(input.allowed_mentions !== undefined && { allowed_mentions: input.allowed_mentions }),
          ...(input.components !== undefined && { components: input.components }),
          ...(input.attachments !== undefined && { attachments: input.attachments }),
        },
        retries: 3,
      });

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        channel_id: providerMessage.channel_id,
        ...(providerMessage.content !== undefined && { content: providerMessage.content }),
        ...(providerMessage.timestamp !== undefined && { timestamp: providerMessage.timestamp }),
        ...(providerMessage.edited_timestamp != null && { edited_timestamp: providerMessage.edited_timestamp }),
        ...(providerMessage.author?.id !== undefined && { author_id: providerMessage.author.id }),
        ...(providerMessage.author?.username !== undefined && { author_username: providerMessage.author.username }),
        ...(providerMessage.author?.bot !== undefined && { author_bot: providerMessage.author.bot }),
        ...(providerMessage.embeds !== undefined && { embeds: providerMessage.embeds }),
        ...(providerMessage.flags !== undefined && { flags: providerMessage.flags }),
        ...(providerMessage.components !== undefined && { components: providerMessage.components }),
        ...(providerMessage.attachments !== undefined && { attachments: providerMessage.attachments }),
      };
    },
  });
}
