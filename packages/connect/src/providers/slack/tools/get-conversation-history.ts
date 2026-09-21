// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getConversationHistoryInputSchema = z.object({
  channel_id: z.string().describe('The conversation ID to fetch history for. Example: "C1234567890"'),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  oldest: z
    .string()
    .optional()
    .describe('Only messages after this Unix timestamp will be included. Example: "1512085950.000216"'),
  latest: z
    .string()
    .optional()
    .describe('Only messages before this Unix timestamp will be included. Example: "1512104434.000490"'),
  inclusive: z
    .boolean()
    .optional()
    .describe('Include messages with oldest or latest timestamps in results. Defaults to false.'),
  limit: z.number().optional().describe('Maximum number of messages to return (max 999). Defaults to 100.'),
});

const MessageSchema = z.object({
  type: z.string(),
  ts: z.string(),
  user: z.string().optional(),
  text: z.string().optional(),
  thread_ts: z.string().optional(),
  reply_count: z.number().optional(),
  reactions: z
    .array(
      z.object({
        name: z.string(),
        count: z.number(),
        users: z.array(z.string()),
      }),
    )
    .optional(),
  attachments: z.array(z.unknown()).optional(),
});

export const getConversationHistoryOutputSchema = z.object({
  messages: z.array(MessageSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
  pin_count: z.number().optional(),
});

const ConversationHistoryResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
  has_more: z.boolean().optional(),
  response_metadata: z
    .object({
      next_cursor: z.string().optional(),
    })
    .optional(),
  pin_count: z.number().optional(),
});

export function getConversationHistoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_conversation_history',
    description: 'Fetch paginated message history for a conversation within optional time bounds',
    inputSchema: getConversationHistoryInputSchema,
    outputSchema: getConversationHistoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getConversationHistoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.slack.dev/reference/methods/conversations.history
      const response = await platformProxy.get({
        endpoint: '/conversations.history',
        params: {
          channel: input.channel_id,
          ...(input.cursor && { cursor: input.cursor }),
          ...(input.oldest && { oldest: input.oldest }),
          ...(input.latest && { latest: input.latest }),
          ...(input.inclusive !== undefined && { inclusive: input.inclusive.toString() }),
          limit: input.limit ?? 100,
        },
        retries: 3,
      });

      const data = ConversationHistoryResponseSchema.parse(response.data);

      if (!data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: data.error || 'Unknown Slack API error',
          channel_id: input.channel_id,
        });
      }

      return {
        messages: data.messages || [],
        has_more: data.has_more || false,
        next_cursor: data.response_metadata?.next_cursor || undefined,
        pin_count: data.pin_count,
      };
    },
  });
}
