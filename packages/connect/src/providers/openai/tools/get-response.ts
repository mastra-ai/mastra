// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getResponseInputSchema = z.object({
  response_id: z
    .string()
    .describe('The ID of the response to retrieve. Must start with "resp_". Example: "resp_abc123"'),
});

const ProviderResponseSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    model: z.string(),
    output: z.array(z.record(z.string(), z.unknown())),
    usage: z
      .object({
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .loose()
      .optional(),
    created_at: z.number(),
  })
  .loose();

export const getResponseOutputSchema = z
  .object({
    id: z.string().describe('The unique identifier of the response.'),
    model: z.string().describe('The model used to generate the response.'),
    output: z.array(z.record(z.string(), z.unknown())).describe('Array of output items from the response.'),
    usage: z
      .object({
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .loose()
      .optional(),
    created_at: z.number().describe('Unix timestamp (in seconds) of when the response was created.'),
  })
  .loose();

export function getResponseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_response',
    description: 'Retrieve a stored OpenAI response by ID.',
    inputSchema: getResponseInputSchema,
    outputSchema: getResponseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getResponseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/responses/get
      const response = await platformProxy.get({
        endpoint: `/v1/responses/${encodeURIComponent(input.response_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Response with ID "${input.response_id}" not found.`,
          response_id: input.response_id,
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return providerResponse;
    },
  });
}
