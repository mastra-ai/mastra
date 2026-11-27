// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listVoicesInputSchema = z.object({});

const ProviderVoiceSchema = z
  .object({
    voice_id: z.string().describe('The ID of the voice. Example: "21m00Tcm4TlvDq8ikWAM"'),
    name: z.string().describe('The name of the voice. Example: "Rachel"'),
    category: z.string().optional().describe('The category of the voice. Example: "premade"'),
    description: z.string().nullable().optional().describe('The description of the voice.'),
    preview_url: z.string().nullable().optional().describe('The preview URL of the voice.'),
    available_for_tiers: z.array(z.string()).optional().describe('The tiers the voice is available for.'),
    labels: z.record(z.string(), z.string()).optional().describe('Labels associated with the voice.'),
    is_owner: z.boolean().nullable().optional().describe('Whether the voice is owned by the user.'),
    is_legacy: z.boolean().optional().describe('Whether the voice is legacy.'),
    is_mixed: z.boolean().optional().describe('Whether the voice is mixed.'),
    created_at_unix: z.number().nullable().optional().describe('The creation time of the voice in Unix time.'),
    high_quality_base_model_ids: z.array(z.string()).optional().describe('The base model IDs for high-quality voices.'),
    verified_languages: z
      .array(
        z.object({
          language: z.string(),
          model_id: z.string(),
          accent: z.string().nullable().optional(),
          locale: z.string().nullable().optional(),
          preview_url: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .optional()
      .describe('The verified languages of the voice.'),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  voices: z.array(ProviderVoiceSchema),
});

const VoiceSchema = z.object({
  voice_id: z.string().describe('The ID of the voice. Example: "21m00Tcm4TlvDq8ikWAM"'),
  name: z.string().describe('The name of the voice. Example: "Rachel"'),
  category: z.string().optional().describe('The category of the voice. Example: "premade"'),
  description: z.string().optional().describe('The description of the voice.'),
  preview_url: z.string().optional().describe('The preview URL of the voice.'),
  available_for_tiers: z.array(z.string()).optional().describe('The tiers the voice is available for.'),
  labels: z.record(z.string(), z.string()).optional().describe('Labels associated with the voice.'),
  is_owner: z.boolean().optional().describe('Whether the voice is owned by the user.'),
  is_legacy: z.boolean().optional().describe('Whether the voice is legacy.'),
  is_mixed: z.boolean().optional().describe('Whether the voice is mixed.'),
  created_at_unix: z.number().optional().describe('The creation time of the voice in Unix time.'),
  high_quality_base_model_ids: z.array(z.string()).optional().describe('The base model IDs for high-quality voices.'),
  verified_languages: z
    .array(
      z.object({
        language: z.string(),
        model_id: z.string(),
        accent: z.string().optional(),
        locale: z.string().optional(),
        preview_url: z.string().optional(),
      }),
    )
    .optional()
    .describe('The verified languages of the voice.'),
});

export const listVoicesOutputSchema = z.object({
  voices: z.array(VoiceSchema),
});

export function listVoicesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_list_voices',
    description: 'List voices',
    inputSchema: listVoicesInputSchema,
    outputSchema: listVoicesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listVoicesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/legacy/voices/get-all
        endpoint: '/v1/voices',
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        voices: providerResponse.voices.map(voice => ({
          voice_id: voice.voice_id,
          name: voice.name,
          ...(voice.category !== undefined && { category: voice.category }),
          ...(voice.description != null && { description: voice.description }),
          ...(voice.preview_url != null && { preview_url: voice.preview_url }),
          ...(voice.available_for_tiers !== undefined && { available_for_tiers: voice.available_for_tiers }),
          ...(voice.labels !== undefined && { labels: voice.labels }),
          ...(voice.is_owner != null && { is_owner: voice.is_owner }),
          ...(voice.is_legacy !== undefined && { is_legacy: voice.is_legacy }),
          ...(voice.is_mixed !== undefined && { is_mixed: voice.is_mixed }),
          ...(voice.created_at_unix != null && { created_at_unix: voice.created_at_unix }),
          ...(voice.high_quality_base_model_ids !== undefined && {
            high_quality_base_model_ids: voice.high_quality_base_model_ids,
          }),
          ...(voice.verified_languages != null && {
            verified_languages: voice.verified_languages.map(lang => ({
              language: lang.language,
              model_id: lang.model_id,
              ...(lang.accent != null && { accent: lang.accent }),
              ...(lang.locale != null && { locale: lang.locale }),
              ...(lang.preview_url != null && { preview_url: lang.preview_url }),
            })),
          }),
        })),
      };
    },
  });
}
