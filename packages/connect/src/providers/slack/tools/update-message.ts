// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateMessageInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel containing the message to update. Example: "C1234567890"'),
  message_ts: z.string().describe('The timestamp of the message to update. Example: "1401383885.000061"'),
  text: z.string().describe('The updated text of the message. Example: "Updated message text"'),
  as_user: z
    .boolean()
    .optional()
    .describe(
      'Pass true to update the message as the authenticated user. Bot users in this context are considered authed users. Default: true',
    ),
  link_names: z
    .boolean()
    .optional()
    .describe(
      'Find and link channel names and usernames. Defaults to false. To use this, you need parse set to "full".',
    ),
  parse: z
    .enum(['none', 'full', 'client'])
    .optional()
    .describe(
      'Change how messages are treated. Defaults to "client" which attempts to discover links. Use "none" to treat text literally, "full" for full parsing with link_names.',
    ),
  unfurl_links: z.boolean().optional().describe('Pass false to disable unfurling of links.'),
  unfurl_media: z.boolean().optional().describe('Pass false to disable unfurling of media content.'),
  reply_broadcast: z
    .boolean()
    .optional()
    .describe('Used to reply to a thread only and not to the channel. Pass true to reply to the channel as well.'),
  blocks: z
    .array(z.object({}).passthrough())
    .optional()
    .describe(
      'A JSON array of blocks to use as the message content. When blocks is provided, text becomes the fallback text for notifications.',
    ),
  attachments: z
    .array(z.object({}).passthrough())
    .optional()
    .describe('A JSON array of legacy attachments. Not recommended for new apps, use blocks instead.'),
});

export const updateMessageOutputSchema = z.object({
  ok: z.boolean().describe('Whether the API call was successful'),
  channel: z.string().describe('The ID of the channel where the message was updated'),
  ts: z.string().describe('The timestamp of the updated message'),
  text: z.string().describe('The updated text of the message'),
  message: z.any().optional().describe('Full message object containing updated message details'),
});

export function updateMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_update_message',
    description: 'Edit an existing message in a Slack channel',
    inputSchema: updateMessageInputSchema,
    outputSchema: updateMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/chat.update
      const response = await platformProxy.post({
        endpoint: '/chat.update',
        data: {
          channel: input.channel_id,
          ts: input.message_ts,
          text: input.text,
          as_user: input.as_user ?? true,
          ...(input.link_names !== undefined && { link_names: input.link_names ? 1 : 0 }),
          ...(input.parse && { parse: input.parse }),
          ...(input.unfurl_links !== undefined && { unfurl_links: input.unfurl_links }),
          ...(input.unfurl_media !== undefined && { unfurl_media: input.unfurl_media }),
          ...(input.reply_broadcast !== undefined && { reply_broadcast: input.reply_broadcast }),
          ...(input.blocks && { blocks: input.blocks }),
          ...(input.attachments && { attachments: input.attachments }),
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Unknown Slack API error',
          channel_id: input.channel_id,
          message_ts: input.message_ts,
        });
      }

      return {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts,
        text: response.data.text || input.text,
        message: response.data.message,
      };
    },
  });
}
