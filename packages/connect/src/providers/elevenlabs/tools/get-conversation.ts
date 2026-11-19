// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getConversationInputSchema = z.object({
  conversation_id: z.string().describe('The ID of the conversation to retrieve. Example: "abc123"'),
});

const TranscriptToolCallSchema = z
  .object({
    request_id: z.string(),
    tool_name: z.string(),
    params_as_json: z.string().optional(),
    tool_has_been_called: z.boolean().optional(),
  })
  .passthrough();

const TranscriptToolResultSchema = z
  .object({
    request_id: z.string(),
    tool_name: z.string(),
    result_value: z.string().optional(),
    is_error: z.boolean().optional(),
    tool_has_been_called: z.boolean().optional(),
  })
  .passthrough();

const TranscriptEntrySchema = z
  .object({
    role: z.string(),
    message: z.string().optional(),
    agent_metadata: z.unknown().nullable().optional(),
    tool_calls: z.array(TranscriptToolCallSchema).optional(),
    tool_results: z.array(TranscriptToolResultSchema).optional(),
    time_in_call_secs: z.number().optional(),
    feedback: z.unknown().nullable().optional(),
    conversation_turn_id: z.string().optional(),
  })
  .passthrough();

const ConversationMetadataSchema = z
  .object({
    start_time_unix_secs: z.number(),
    accepted_time_unix_secs: z.number().nullable().optional(),
    call_duration_secs: z.number(),
    cost: z.number().nullable().optional(),
    deletion_settings: z.unknown().nullable().optional(),
    feedback: z.unknown().nullable().optional(),
    authorization_method: z.string().optional(),
    charging: z.unknown().nullable().optional(),
    phone_call: z.unknown().nullable().optional(),
    whatsapp: z.unknown().nullable().optional(),
    agent_phone_number: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    voice_rewards: z.unknown().nullable().optional(),
  })
  .passthrough();

const ConversationAnalysisSchema = z
  .object({
    evaluation_criteria_results: z.unknown().nullable().optional(),
    data_collection_results: z.unknown().nullable().optional(),
    call_successful: z.string().optional(),
    transcript_summary: z.string().optional(),
    summary: z.string().optional(),
    scoped: z.unknown().nullable().optional(),
  })
  .passthrough();

const VisitedAgentSchema = z
  .object({
    agent_id: z.string(),
    branch_id: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    conversation_id: z.string(),
    agent_id: z.string(),
    agent_name: z.string().nullable().optional(),
    conversation_product: z.string().optional(),
    status: z.string(),
    user_id: z.string().nullable().optional(),
    branch_id: z.string().nullable().optional(),
    version_id: z.string().nullable().optional(),
    environment: z.string().nullable().optional(),
    has_audio: z.boolean().optional(),
    has_user_audio: z.boolean().optional(),
    has_response_audio: z.boolean().optional(),
    transcript: z.array(TranscriptEntrySchema).optional(),
    metadata: ConversationMetadataSchema,
    analysis: ConversationAnalysisSchema.nullable().optional(),
    visited_agents: z.array(VisitedAgentSchema).optional(),
    conversation_initiation_client_data: z.unknown().nullable().optional(),
    tag_ids: z.array(z.string()).optional(),
    otlpTraces: z.unknown().nullable().optional(),
  })
  .passthrough();

export const getConversationOutputSchema = ProviderResponseSchema;

export function getConversationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_conversation',
    description: 'Retrieve a Conversational AI conversation.',
    inputSchema: getConversationInputSchema,
    outputSchema: getConversationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getConversationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://elevenlabs.io/docs/api-reference/conversations/get
      const response = await platformProxy.get({
        endpoint: `/v1/convai/conversations/${encodeURIComponent(input.conversation_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Conversation not found',
          conversation_id: input.conversation_id,
        });
      }

      const conversation = ProviderResponseSchema.parse(response.data);
      return conversation;
    },
  });
}
