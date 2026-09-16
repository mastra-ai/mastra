// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ThinkingConfigSchema = z.object({
  type: z.string().describe('Thinking configuration type. Example: "enabled"'),
  budget_tokens: z.number().int().describe('Token budget for thinking. Example: 1024'),
});

const ToolChoiceSchema = z.object({
  type: z.string().describe('Tool choice type. Example: "auto", "any", "tool"'),
  name: z.string().optional().describe('Tool name when type is "tool". Example: "my_tool"'),
});

const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ImageBlockSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.string(),
    media_type: z.string(),
    data: z.string(),
  }),
});

const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.union([TextBlockSchema, ImageBlockSchema]))]).optional(),
  is_error: z.boolean().optional(),
});

const ContentBlockSchema = z.union([TextBlockSchema, ImageBlockSchema, ToolUseBlockSchema, ToolResultBlockSchema]);

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  }),
});

export const createMessageInputSchema = z.object({
  model: z.string().describe('Anthropic model ID. Example: "claude-3-5-sonnet-20241022"'),
  max_tokens: z.number().int().describe('Maximum tokens to generate. Example: 1024'),
  messages: z.array(MessageSchema).describe('Conversation messages'),
  system: z
    .union([z.string(), z.array(TextBlockSchema)])
    .optional()
    .describe('System prompt'),
  tools: z.array(ToolSchema).optional().describe('Tools available to the model'),
  tool_choice: ToolChoiceSchema.optional().describe('Tool choice configuration'),
  thinking: ThinkingConfigSchema.optional().describe('Thinking configuration'),
  temperature: z.number().optional().describe('Sampling temperature'),
  top_k: z.number().int().optional().describe('Top-k sampling parameter'),
  top_p: z.number().optional().describe('Top-p sampling parameter'),
  stop_sequences: z.array(z.string()).optional().describe('Stop sequences'),
  metadata: z.record(z.string(), z.string()).optional().describe('Metadata key-value pairs'),
});

const UsageSchema = z.object({
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  cache_creation_input_tokens: z.number().int().optional(),
  cache_read_input_tokens: z.number().int().optional(),
});

const OutputContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string().optional(),
  }),
  z.object({
    type: z.literal('redacted_thinking'),
    data: z.string(),
  }),
]);

export const createMessageOutputSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(OutputContentBlockSchema),
  model: z.string(),
  stop_reason: z.union([z.string(), z.null()]).optional(),
  stop_sequence: z.union([z.string(), z.null()]).optional(),
  usage: UsageSchema,
});

export function createMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_create_message',
    description: 'Create an Anthropic model message.',
    inputSchema: createMessageInputSchema,
    outputSchema: createMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: {
        model: string;
        max_tokens: number;
        messages: z.infer<typeof MessageSchema>[];
        system?: z.infer<typeof createMessageInputSchema>['system'];
        tools?: z.infer<typeof createMessageInputSchema>['tools'];
        tool_choice?: z.infer<typeof createMessageInputSchema>['tool_choice'];
        thinking?: z.infer<typeof createMessageInputSchema>['thinking'];
        temperature?: z.infer<typeof createMessageInputSchema>['temperature'];
        top_k?: z.infer<typeof createMessageInputSchema>['top_k'];
        top_p?: z.infer<typeof createMessageInputSchema>['top_p'];
        stop_sequences?: z.infer<typeof createMessageInputSchema>['stop_sequences'];
        metadata?: z.infer<typeof createMessageInputSchema>['metadata'];
      } = {
        model: input.model,
        max_tokens: input.max_tokens,
        messages: input.messages,
      };

      if (input.system !== undefined) {
        data.system = input.system;
      }
      if (input.tools !== undefined) {
        data.tools = input.tools;
      }
      if (input.tool_choice !== undefined) {
        data.tool_choice = input.tool_choice;
      }
      if (input.thinking !== undefined) {
        data.thinking = input.thinking;
      }
      if (input.temperature !== undefined) {
        data.temperature = input.temperature;
      }
      if (input.top_k !== undefined) {
        data.top_k = input.top_k;
      }
      if (input.top_p !== undefined) {
        data.top_p = input.top_p;
      }
      if (input.stop_sequences !== undefined) {
        data.stop_sequences = input.stop_sequences;
      }
      if (input.metadata !== undefined) {
        data.metadata = input.metadata;
      }

      // https://docs.anthropic.com/en/api/messages
      const response = await platformProxy.post({
        endpoint: '/v1/messages',
        data,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'Received an empty response from Anthropic API.',
        });
      }

      if (
        response.data &&
        typeof response.data === 'object' &&
        'type' in response.data &&
        response.data.type === 'error' &&
        'error' in response.data &&
        response.data.error &&
        typeof response.data.error === 'object'
      ) {
        const errorData = response.data.error;
        const errorMessage = 'message' in errorData ? String(errorData.message) : 'Unknown Anthropic API error';
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: errorMessage,
          details: response.data.error,
        });
      }

      const parsed = createMessageOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
