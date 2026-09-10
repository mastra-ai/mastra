// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ModerationCategorySchema = z.object({
  sexual: z.boolean(),
  hate: z.boolean(),
  harassment: z.boolean(),
  'self-harm': z.boolean(),
  'sexual/minors': z.boolean(),
  'hate/threatening': z.boolean(),
  'violence/graphic': z.boolean(),
  'self-harm/intent': z.boolean(),
  'self-harm/instructions': z.boolean(),
  'harassment/threatening': z.boolean(),
  violence: z.boolean(),
});

const ModerationCategoryScoresSchema = z.object({
  sexual: z.number(),
  hate: z.number(),
  harassment: z.number(),
  'self-harm': z.number(),
  'sexual/minors': z.number(),
  'hate/threatening': z.number(),
  'violence/graphic': z.number(),
  'self-harm/intent': z.number(),
  'self-harm/instructions': z.number(),
  'harassment/threatening': z.number(),
  violence: z.number(),
});

const ModerationResultSchema = z.object({
  flagged: z.boolean(),
  categories: ModerationCategorySchema,
  category_scores: ModerationCategoryScoresSchema,
});

const ProviderModerationResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  results: z.array(ModerationResultSchema),
});

export const createModerationInputSchema = z.object({
  input: z
    .union([z.string(), z.array(z.string())])
    .describe('Text or array of text strings to classify. Example: "I want to hurt someone."'),
  model: z
    .string()
    .optional()
    .describe(
      'Model to use for moderation. Defaults to "omni-moderation-latest". Other option: "text-moderation-latest".',
    ),
});

export const createModerationOutputSchema = z.object({
  id: z.string(),
  model: z.string(),
  results: z.array(
    z.object({
      flagged: z.boolean(),
      categories: z.record(z.string(), z.boolean()),
      category_scores: z.record(z.string(), z.number()),
    }),
  ),
});

export function createModerationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_moderation',
    description: 'Classify whether text or images violate OpenAI usage policies',
    inputSchema: createModerationInputSchema,
    outputSchema: createModerationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createModerationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/moderations/create
      const response = await platformProxy.post({
        endpoint: '/v1/moderations',
        data: {
          input: input.input,
          ...(input.model !== undefined && { model: input.model }),
        },
        retries: 3,
      });

      const moderationResponse = ProviderModerationResponseSchema.parse(response.data);

      return {
        id: moderationResponse.id,
        model: moderationResponse.model,
        results: moderationResponse.results.map(result => ({
          flagged: result.flagged,
          categories: result.categories,
          category_scores: result.category_scores,
        })),
      };
    },
  });
}
