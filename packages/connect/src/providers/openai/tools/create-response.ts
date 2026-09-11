// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createResponseInputSchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
  instructions: z.string().optional(),
  tools: z.array(z.record(z.string(), z.unknown())).optional(),
  tool_choice: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  temperature: z.number().optional(),
  max_output_tokens: z.number().optional(),
  store: z.boolean().optional(),
});

const ResponseUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
});

const OutputItemSchema = z.record(z.string(), z.unknown());

const ResponseSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  created_at: z.number().optional(),
  status: z.string().optional(),
  model: z.string().optional(),
  output: z.array(OutputItemSchema),
  usage: ResponseUsageSchema.optional(),
});

export const createResponseOutputSchema = z.object({
  id: z.string(),
  output: z.array(z.record(z.string(), z.unknown())),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});

export function createResponseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_response',
    description: 'Create a model response with text, image, file, or tool inputs',
    inputSchema: createResponseInputSchema,
    outputSchema: createResponseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createResponseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        model: input.model,
        input: input.input,
        store: input.store !== undefined ? input.store : true,
      };

      if (input.instructions !== undefined) {
        requestBody['instructions'] = input.instructions;
      }

      if (input.tools !== undefined) {
        requestBody['tools'] = input.tools;
      }

      if (input.tool_choice !== undefined) {
        requestBody['tool_choice'] = input.tool_choice;
      }

      if (input.temperature !== undefined) {
        requestBody['temperature'] = input.temperature;
      }

      if (input.max_output_tokens !== undefined) {
        requestBody['max_output_tokens'] = input.max_output_tokens;
      }

      // https://platform.openai.com/docs/api-reference/responses/create
      const response = await platformProxy.post({
        endpoint: '/v1/responses',
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'no_response',
          message: 'No response received from OpenAI API',
        });
      }

      const providerResponse = ResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        output: providerResponse.output,
        ...(providerResponse.usage !== undefined && {
          usage: {
            input_tokens: providerResponse.usage.input_tokens,
            output_tokens: providerResponse.usage.output_tokens,
            total_tokens: providerResponse.usage.total_tokens,
          },
        }),
      };
    },
  });
}
