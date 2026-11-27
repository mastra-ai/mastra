// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listConversationsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  agent_id: z.string().optional().describe('Agent id (agent_…) or speech engine external id (seng_).'),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of conversations to return. Defaults to 30.'),
});

const ProviderConversationSchema = z.object({
  agent_id: z.string(),
  branch_id: z.string().nullable().optional(),
  version_id: z.string().nullable().optional(),
  agent_name: z.string().nullable().optional(),
  conversation_id: z.string(),
  start_time_unix_secs: z.number().int(),
  call_duration_secs: z.number().int(),
  message_count: z.number().int(),
  status: z.string(),
  termination_reason: z.string().optional(),
  call_successful: z.string(),
  transcript_summary: z.string().nullable().optional(),
  call_summary_title: z.string().nullable().optional(),
  main_language: z.string().nullable().optional(),
  conversation_initiation_source: z.string().nullable().optional(),
  tool_names: z.array(z.string()).nullable().optional(),
  direction: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  conversations: z.array(ProviderConversationSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

const ConversationSchema = z.object({
  agent_id: z.string(),
  conversation_id: z.string(),
  start_time_unix_secs: z.number().int(),
  call_duration_secs: z.number().int(),
  message_count: z.number().int(),
  status: z.string(),
  call_successful: z.string(),
  branch_id: z.string().optional(),
  version_id: z.string().optional(),
  agent_name: z.string().optional(),
  termination_reason: z.string().optional(),
  transcript_summary: z.string().optional(),
  call_summary_title: z.string().optional(),
  main_language: z.string().optional(),
  conversation_initiation_source: z.string().optional(),
  tool_names: z.array(z.string()).optional(),
  direction: z.string().optional(),
  rating: z.number().optional(),
});

export const listConversationsOutputSchema = z.object({
  items: z.array(ConversationSchema),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export function listConversationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_list_conversations',
    description: 'List Conversational AI conversations.',
    inputSchema: listConversationsInputSchema,
    outputSchema: listConversationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listConversationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://elevenlabs.io/docs/api-reference/conversations/list
      const response = await platformProxy.get({
        endpoint: '/v1/convai/conversations',
        params: {
          ...(input.cursor !== undefined && { cursor: input.cursor }),
          ...(input.agent_id !== undefined && { agent_id: input.agent_id }),
          ...(input.page_size !== undefined && { page_size: String(input.page_size) }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.conversations.map(conversation => ({
          agent_id: conversation.agent_id,
          conversation_id: conversation.conversation_id,
          start_time_unix_secs: conversation.start_time_unix_secs,
          call_duration_secs: conversation.call_duration_secs,
          message_count: conversation.message_count,
          status: conversation.status,
          call_successful: conversation.call_successful,
          ...(conversation.branch_id != null && { branch_id: conversation.branch_id }),
          ...(conversation.version_id != null && { version_id: conversation.version_id }),
          ...(conversation.agent_name != null && { agent_name: conversation.agent_name }),
          ...(conversation.termination_reason !== undefined &&
            conversation.termination_reason !== '' && { termination_reason: conversation.termination_reason }),
          ...(conversation.transcript_summary != null && { transcript_summary: conversation.transcript_summary }),
          ...(conversation.call_summary_title != null && { call_summary_title: conversation.call_summary_title }),
          ...(conversation.main_language != null && { main_language: conversation.main_language }),
          ...(conversation.conversation_initiation_source != null && {
            conversation_initiation_source: conversation.conversation_initiation_source,
          }),
          ...(conversation.tool_names != null && { tool_names: conversation.tool_names }),
          ...(conversation.direction != null && { direction: conversation.direction }),
          ...(conversation.rating != null && { rating: conversation.rating }),
        })),
        ...(providerResponse.next_cursor != null && { next_cursor: providerResponse.next_cursor }),
        has_more: providerResponse.has_more,
      };
    },
  });
}
