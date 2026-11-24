// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDefaultVoiceSettingsInputSchema = z.object({});

const ProviderVoiceSettingsSchema = z.object({
  stability: z.number().nullable(),
  similarity_boost: z.number().nullable(),
  style: z.number().nullable(),
  use_speaker_boost: z.boolean().nullable(),
  speed: z.number().nullable(),
});

export const getDefaultVoiceSettingsOutputSchema = z.object({
  stability: z.number().optional(),
  similarity_boost: z.number().optional(),
  style: z.number().optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().optional(),
});

export function getDefaultVoiceSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_default_voice_settings',
    description: 'Get the account default voice settings.',
    inputSchema: getDefaultVoiceSettingsInputSchema,
    outputSchema: getDefaultVoiceSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDefaultVoiceSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/voices/settings/get-default
        endpoint: '/v1/voices/settings/default',
        retries: 3,
      });

      const providerSettings = ProviderVoiceSettingsSchema.parse(response.data);

      return {
        ...(providerSettings.stability != null && { stability: providerSettings.stability }),
        ...(providerSettings.similarity_boost != null && { similarity_boost: providerSettings.similarity_boost }),
        ...(providerSettings.style != null && { style: providerSettings.style }),
        ...(providerSettings.use_speaker_boost != null && { use_speaker_boost: providerSettings.use_speaker_boost }),
        ...(providerSettings.speed != null && { speed: providerSettings.speed }),
      };
    },
  });
}
