// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateWebhookInputSchema = z.object({
  webhook_id: z.string().describe('The ID of the webhook to update. Example: "223704706495545344"'),
  name: z.string().optional().describe('The new name of the webhook (1-80 characters).'),
  avatar: z
    .string()
    .nullable()
    .optional()
    .describe('The base64-encoded image data for the webhook avatar, or null to remove.'),
  channel_id: z.string().optional().describe('The new channel ID to move the webhook to.'),
});

const ProviderWebhookSchema = z.object({
  id: z.string(),
  type: z.number(),
  guild_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  token: z.string().optional(),
  application_id: z.string().nullable().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().nullable().optional(),
      public_flags: z.number().optional(),
    })
    .optional(),
});

export const updateWebhookOutputSchema = z.object({
  id: z.string(),
  type: z.number(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  name: z.string().optional(),
  avatar: z.string().optional(),
  token: z.string().optional(),
  application_id: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().optional(),
      public_flags: z.number().optional(),
    })
    .optional(),
});

export function updateWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_webhook',
    description: 'Update a webhook in Discord.',
    inputSchema: updateWebhookInputSchema,
    outputSchema: updateWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata: unknown = await platformProxy.getMetadata();
      const botToken =
        metadata && typeof metadata === 'object' && 'botToken' in metadata && typeof metadata.botToken === 'string'
          ? metadata.botToken
          : undefined;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      // Build the request body with only provided fields
      const requestBody: Record<string, unknown> = {};
      if (input.name !== undefined) {
        requestBody['name'] = input.name;
      }
      if (input.avatar !== undefined) {
        requestBody['avatar'] = input.avatar;
      }
      if (input.channel_id !== undefined) {
        requestBody['channel_id'] = input.channel_id;
      }

      // https://discord.com/developers/docs/resources/webhook#modify-webhook
      const response = await platformProxy.patch({
        endpoint: `/api/v10/webhooks/${input.webhook_id}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        data: requestBody,
        retries: 3,
      });

      const providerWebhook = ProviderWebhookSchema.parse(response.data);

      return {
        id: providerWebhook.id,
        type: providerWebhook.type,
        ...(providerWebhook.guild_id != null && { guild_id: providerWebhook.guild_id }),
        ...(providerWebhook.channel_id != null && { channel_id: providerWebhook.channel_id }),
        ...(providerWebhook.name != null && { name: providerWebhook.name }),
        ...(providerWebhook.avatar != null && { avatar: providerWebhook.avatar }),
        ...(providerWebhook.token != null && { token: providerWebhook.token }),
        ...(providerWebhook.application_id != null && { application_id: providerWebhook.application_id }),
        ...(providerWebhook.user != null && {
          user: {
            id: providerWebhook.user.id,
            username: providerWebhook.user.username,
            discriminator: providerWebhook.user.discriminator,
            ...(providerWebhook.user.avatar != null && { avatar: providerWebhook.user.avatar }),
            ...(providerWebhook.user.public_flags != null && { public_flags: providerWebhook.user.public_flags }),
          },
        }),
      };
    },
  });
}
