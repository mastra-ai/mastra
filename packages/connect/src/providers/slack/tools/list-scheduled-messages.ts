// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listScheduledMessagesInputSchema = z.object({
  channel_id: z.string().optional().describe('The channel ID to filter scheduled messages by. Example: "C123456789"'),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of entries to return. Default: 100'),
  oldest: z.number().int().optional().describe('Unix timestamp of the earliest scheduled message to include'),
  latest: z.number().int().optional().describe('Unix timestamp of the latest scheduled message to include'),
});

const ScheduledMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  post_at: z.number().int().describe('Unix timestamp when the message will be posted'),
  date_created: z.number().int().describe('Unix timestamp when the message was scheduled'),
  text: z.string(),
});

export const listScheduledMessagesOutputSchema = z.object({
  messages: z.array(ScheduledMessageSchema),
  next_cursor: z.string().optional().describe('Pagination cursor for next page. Omitted if no more pages.'),
});

export function listScheduledMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_scheduled_messages',
    description: 'List pending scheduled messages',
    inputSchema: listScheduledMessagesInputSchema,
    outputSchema: listScheduledMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listScheduledMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.channel_id) {
        params['channel'] = input.channel_id;
      }
      if (input.cursor) {
        params['cursor'] = input.cursor;
      }
      if (input.limit) {
        params['limit'] = input.limit;
      }
      if (input.oldest !== undefined) {
        params['oldest'] = input.oldest;
      }
      if (input.latest !== undefined) {
        params['latest'] = input.latest;
      }

      // https://api.slack.com/methods/chat.scheduledMessages.list
      const response = await platformProxy.get({
        endpoint: 'chat.scheduledMessages.list',
        params,
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Unknown Slack API error',
        });
      }

      const scheduledMessages = (response.data.scheduled_messages || []).map(
        (msg: { id: number | string; channel_id: string; post_at: number; date_created: number; text: string }) => ({
          id: String(msg.id),
          channel_id: msg.channel_id,
          post_at: msg.post_at,
          date_created: msg.date_created,
          text: msg.text,
        }),
      );

      return {
        messages: scheduledMessages,
        next_cursor: response.data.response_metadata?.next_cursor || undefined,
      };
    },
  });
}
