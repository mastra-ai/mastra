// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
});

export const createChatCompletionInputSchema = z.object({
  model: z.string().describe('Model ID. Example: "gpt-4o-mini"'),
  messages: z.array(MessageSchema).describe('Array of messages with role and content'),
  temperature: z.number().optional().describe('Sampling temperature (0-2)'),
  max_tokens: z.number().optional().describe('Maximum tokens to generate'),
  tools: z.array(z.unknown()).optional().describe('Tools available to the model'),
  tool_choice: z.unknown().optional().describe('Tool choice strategy'),
  response_format: z.unknown().optional().describe('Response format specification'),
  stream: z.boolean().optional().describe('Stream response. Should be false for actions'),
});

const ChoiceSchema = z.object({
  index: z.number(),
  message: z.object({
    role: z.string(),
    content: z.string().nullable().optional(),
  }),
  finish_reason: z.string().nullable().optional(),
});

const UsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChoiceSchema),
  usage: UsageSchema.optional(),
});

export const createChatCompletionOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChoiceSchema),
  usage: UsageSchema.optional(),
});

export function createChatCompletionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_chat_completion',
    description: 'Create a Chat Completions API response for compatibility workflows',
    inputSchema: createChatCompletionInputSchema,
    outputSchema: createChatCompletionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChatCompletionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/chat/create
      const response = await platformProxy.post({
        endpoint: '/v1/chat/completions',
        data: {
          model: input.model,
          messages: input.messages,
          ...(input.temperature !== undefined && { temperature: input.temperature }),
          ...(input.max_tokens !== undefined && { max_tokens: input.max_tokens }),
          ...(input.tools !== undefined && { tools: input.tools }),
          ...(input.tool_choice !== undefined && { tool_choice: input.tool_choice }),
          ...(input.response_format !== undefined && { response_format: input.response_format }),
          ...(input.stream !== undefined && { stream: input.stream }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        object: providerResponse.object,
        created: providerResponse.created,
        model: providerResponse.model,
        choices: providerResponse.choices,
        ...(providerResponse.usage !== undefined && { usage: providerResponse.usage }),
      };
    },
  });
}
