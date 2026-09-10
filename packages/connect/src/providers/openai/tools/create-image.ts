// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createImageInputSchema = z.object({
  prompt: z.string().describe('A text description of the desired image(s). The maximum length is 1000 characters.'),
  model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']).optional().describe('The model to use for image generation.'),
  n: z.number().int().min(1).max(10).optional().describe('The number of images to generate. Must be between 1 and 10.'),
  size: z
    .enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
    .optional()
    .describe(
      'The size of the generated images. For dall-e-2: 256x256, 512x512, 1024x1024. For dall-e-3: 1024x1024, 1792x1024, 1024x1792.',
    ),
  quality: z
    .enum(['standard', 'hd'])
    .optional()
    .describe('The quality of the image. hd is available only for dall-e-3.'),
  response_format: z.enum(['url', 'b64_json']).optional().describe('The format of the returned images.'),
});

const ProviderImageDataSchema = z.object({
  url: z.string().optional(),
  b64_json: z.string().optional(),
  revised_prompt: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  created: z.number().optional(),
  data: z.array(ProviderImageDataSchema),
});

export const createImageOutputSchema = z.object({
  created: z.number().optional(),
  data: z.array(
    z.object({
      url: z.string().optional(),
      b64_json: z.string().optional(),
      revised_prompt: z.string().optional(),
    }),
  ),
});

export function createImageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_image',
    description: 'Generate an image from a prompt.',
    inputSchema: createImageInputSchema,
    outputSchema: createImageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createImageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/images/create
      const response = await platformProxy.post({
        endpoint: '/v1/images/generations',
        data: {
          prompt: input.prompt,
          model: input.model ?? 'dall-e-2',
          ...(input.n !== undefined && { n: input.n }),
          ...(input.size !== undefined && { size: input.size }),
          ...(input.quality !== undefined && { quality: input.quality }),
          ...(input.response_format !== undefined && { response_format: input.response_format }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        ...(providerResponse.created !== undefined && { created: providerResponse.created }),
        data: providerResponse.data.map(item => ({
          ...(item.url !== undefined && { url: item.url }),
          ...(item.b64_json !== undefined && { b64_json: item.b64_json }),
          ...(item.revised_prompt !== undefined && { revised_prompt: item.revised_prompt }),
        })),
      };
    },
  });
}
