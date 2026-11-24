// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getVoiceInputSchema = z.object({
  voice_id: z.string().describe('Voice ID. Example: "CwhRBWXzGAHq8TQ4Fs17"'),
});

const VoiceSampleSchema = z.object({
  sample_id: z.string().optional(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  size_bytes: z.number().optional(),
  hash: z.string().optional(),
});

const VoiceSettingsSchema = z.object({
  stability: z.number().optional(),
  similarity_boost: z.number().optional(),
  style: z.number().optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().optional(),
});

const ProviderVoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string().nullable().optional(),
  samples: z.array(VoiceSampleSchema).nullable().optional(),
  category: z.string().nullable().optional(),
  fine_tuning: z.object({}).passthrough().nullable().optional(),
  labels: z.record(z.string(), z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  available_for_tiers: z.array(z.string()).nullable().optional(),
  settings: VoiceSettingsSchema.nullable().optional(),
  sharing: z.object({}).passthrough().nullable().optional(),
  high_quality_base_model_ids: z.array(z.string()).nullable().optional(),
  safety_control: z.string().nullable().optional(),
  voice_verification: z.object({}).passthrough().nullable().optional(),
  permission_on_resource: z.string().nullable().optional(),
  is_legacy: z.boolean().nullable().optional(),
  is_mixed: z.boolean().nullable().optional(),
  is_new: z.boolean().nullable().optional(),
});

export const getVoiceOutputSchema = z.object({
  voice_id: z.string(),
  name: z.string().optional(),
  samples: z.array(VoiceSampleSchema).optional(),
  category: z.string().optional(),
  fine_tuning: z.object({}).passthrough().optional(),
  labels: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  preview_url: z.string().optional(),
  available_for_tiers: z.array(z.string()).optional(),
  settings: VoiceSettingsSchema.optional(),
  sharing: z.object({}).passthrough().optional(),
  high_quality_base_model_ids: z.array(z.string()).optional(),
  safety_control: z.string().optional(),
  voice_verification: z.object({}).passthrough().optional(),
  permission_on_resource: z.string().optional(),
  is_legacy: z.boolean().optional(),
  is_mixed: z.boolean().optional(),
  is_new: z.boolean().optional(),
});

export function getVoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_voice',
    description: 'Retrieve a voice.',
    inputSchema: getVoiceInputSchema,
    outputSchema: getVoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference
        endpoint: `/v1/voices/${encodeURIComponent(input.voice_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Voice not found: ${input.voice_id}`,
        });
      }

      const providerVoice = ProviderVoiceSchema.parse(response.data);

      return {
        voice_id: providerVoice.voice_id,
        ...(providerVoice.name != null && { name: providerVoice.name }),
        ...(providerVoice.samples != null && { samples: providerVoice.samples }),
        ...(providerVoice.category != null && { category: providerVoice.category }),
        ...(providerVoice.fine_tuning != null && { fine_tuning: providerVoice.fine_tuning }),
        ...(providerVoice.labels != null && { labels: providerVoice.labels }),
        ...(providerVoice.description != null && { description: providerVoice.description }),
        ...(providerVoice.preview_url != null && { preview_url: providerVoice.preview_url }),
        ...(providerVoice.available_for_tiers != null && { available_for_tiers: providerVoice.available_for_tiers }),
        ...(providerVoice.settings != null && { settings: providerVoice.settings }),
        ...(providerVoice.sharing != null && { sharing: providerVoice.sharing }),
        ...(providerVoice.high_quality_base_model_ids != null && {
          high_quality_base_model_ids: providerVoice.high_quality_base_model_ids,
        }),
        ...(providerVoice.safety_control != null && { safety_control: providerVoice.safety_control }),
        ...(providerVoice.voice_verification != null && { voice_verification: providerVoice.voice_verification }),
        ...(providerVoice.permission_on_resource != null && {
          permission_on_resource: providerVoice.permission_on_resource,
        }),
        ...(providerVoice.is_legacy != null && { is_legacy: providerVoice.is_legacy }),
        ...(providerVoice.is_mixed != null && { is_mixed: providerVoice.is_mixed }),
        ...(providerVoice.is_new != null && { is_new: providerVoice.is_new }),
      };
    },
  });
}
