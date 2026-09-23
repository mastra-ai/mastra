// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createEmbeddingInputSchema = z.object({
  model: z.string().describe('ID of the model to use. Example: "text-embedding-3-small"'),
  input: z
    .union([z.string(), z.array(z.string())])
    .describe('Input text to embed, encoded as a string or array of strings.'),
  encodingFormat: z
    .enum(['float', 'base64'])
    .optional()
    .describe('The format to return the embeddings in. Can be "float" or "base64".'),
  dimensions: z
    .number()
    .optional()
    .describe(
      'The number of dimensions the resulting output embeddings should have. Only supported in text-embedding-3 and later models.',
    ),
});

const EmbeddingDataSchema = z.object({
  object: z.string(),
  embedding: z.array(z.number()),
  index: z.number(),
});

const UsageSchema = z.object({
  prompt_tokens: z.number(),
  total_tokens: z.number(),
});

const ProviderResponseSchema = z.object({
  object: z.string(),
  data: z.array(EmbeddingDataSchema),
  model: z.string(),
  usage: UsageSchema,
});

export const createEmbeddingOutputSchema = z.object({
  object: z.string(),
  data: z.array(
    z.object({
      object: z.string(),
      embedding: z.array(z.number()),
      index: z.number(),
    }),
  ),
  model: z.string(),
  usage: z.object({
    promptTokens: z.number(),
    totalTokens: z.number(),
  }),
});

export function createEmbeddingTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_embedding',
    description: 'Create embeddings for text inputs.',
    inputSchema: createEmbeddingInputSchema,
    outputSchema: createEmbeddingOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createEmbeddingOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/embeddings/create
      const response = await platformProxy.post({
        endpoint: '/v1/embeddings',
        data: {
          model: input.model,
          input: input.input,
          ...(input.encodingFormat !== undefined && { encoding_format: input.encodingFormat }),
          ...(input.dimensions !== undefined && { dimensions: input.dimensions }),
        },
        retries: 3,
      });

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'insufficient_quota',
          message: 'The API key does not have sufficient billing quota for this request.',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        object: providerResponse.object,
        data: providerResponse.data.map(item => ({
          object: item.object,
          embedding: item.embedding,
          index: item.index,
        })),
        model: providerResponse.model,
        usage: {
          promptTokens: providerResponse.usage.prompt_tokens,
          totalTokens: providerResponse.usage.total_tokens,
        },
      };
    },
  });
}
