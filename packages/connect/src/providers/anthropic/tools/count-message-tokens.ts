// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
});

export const countMessageTokensInputSchema = z.object({
  model: z.string().describe('The model that will count tokens. Example: "claude-sonnet-4-0"'),
  messages: z.array(MessageSchema).describe('Input messages to count tokens for.'),
  system: z
    .union([z.string(), z.array(z.record(z.string(), z.unknown()))])
    .optional()
    .describe('System prompt.'),
  thinking: z.unknown().optional().describe('Thinking configuration.'),
  tools: z.array(z.unknown()).optional().describe('Tool definitions.'),
  tool_choice: z.unknown().optional().describe('Tool choice configuration.'),
  cache_control: z.unknown().optional().describe('Cache control configuration.'),
  output_config: z.unknown().optional().describe('Output format configuration.'),
});

export const countMessageTokensOutputSchema = z.object({
  input_tokens: z
    .number()
    .describe('The total number of tokens across the provided list of messages, system prompt, and tools.'),
});

export function countMessageTokensTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_count_message_tokens',
    description: 'Count tokens for an Anthropic message request.',
    inputSchema: countMessageTokensInputSchema,
    outputSchema: countMessageTokensOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof countMessageTokensOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.anthropic.com/en/api/messages-count-tokens
        endpoint: '/v1/messages/count_tokens',
        data: {
          model: input.model,
          messages: input.messages,
          ...(input.system !== undefined && { system: input.system }),
          ...(input.thinking !== undefined && { thinking: input.thinking }),
          ...(input.tools !== undefined && { tools: input.tools }),
          ...(input.tool_choice !== undefined && { tool_choice: input.tool_choice }),
          ...(input.cache_control !== undefined && { cache_control: input.cache_control }),
          ...(input.output_config !== undefined && { output_config: input.output_config }),
        },
        retries: 3,
      });

      const providerResponse = countMessageTokensOutputSchema.parse(response.data);

      return {
        input_tokens: providerResponse.input_tokens,
      };
    },
  });
}
