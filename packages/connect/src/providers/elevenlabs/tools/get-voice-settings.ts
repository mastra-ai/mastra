// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getVoiceSettingsInputSchema = z.object({
  voice_id: z.string().min(1).describe('Voice ID. Example: "CwhRBWXzGAHq8TQ4Fs17"'),
});

const ProviderVoiceSettingsSchema = z.object({
  stability: z.number().optional(),
  similarity_boost: z.number().optional(),
  style: z.number().optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().optional(),
});

export const getVoiceSettingsOutputSchema = z.object({
  stability: z.number().optional(),
  similarity_boost: z.number().optional(),
  style: z.number().optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().optional(),
});

export function getVoiceSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_voice_settings',
    description: 'Get settings for a specific voice.',
    inputSchema: getVoiceSettingsInputSchema,
    outputSchema: getVoiceSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVoiceSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/voices/settings/get
        endpoint: `/v1/voices/${encodeURIComponent(input.voice_id)}/settings`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Voice settings not found',
          voice_id: input.voice_id,
        });
      }

      const providerSettings = ProviderVoiceSettingsSchema.parse(response.data);

      return {
        ...(providerSettings.stability !== undefined && { stability: providerSettings.stability }),
        ...(providerSettings.similarity_boost !== undefined && { similarity_boost: providerSettings.similarity_boost }),
        ...(providerSettings.style !== undefined && { style: providerSettings.style }),
        ...(providerSettings.use_speaker_boost !== undefined && {
          use_speaker_boost: providerSettings.use_speaker_boost,
        }),
        ...(providerSettings.speed !== undefined && { speed: providerSettings.speed }),
      };
    },
  });
}
