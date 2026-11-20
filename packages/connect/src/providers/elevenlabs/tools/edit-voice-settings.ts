// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const editVoiceSettingsInputSchema = z.object({
  voice_id: z.string().describe('ID of the voice to be used. Example: "29vD33N1CtxCmqQRPOHJ"'),
  stability: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Determines how stable the voice is and the randomness between each generation. Defaults to 0.5'),
  use_speaker_boost: z.boolean().optional().describe('Boosts the similarity to the original speaker. Defaults to true'),
  similarity_boost: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Determines how closely the AI should adhere to the original voice. Defaults to 0.75'),
  style: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Determines the style exaggeration of the voice. Must be between 0 and 1. Defaults to 0'),
  speed: z
    .number()
    .min(0.7)
    .max(1.2)
    .optional()
    .describe('Adjusts the speed of the voice. Must be between 0.7 and 1.2. Defaults to 1'),
});

const ProviderResponseSchema = z.object({
  status: z.string(),
});

export const editVoiceSettingsOutputSchema = z.object({
  status: z
    .string()
    .describe('The status of the voice settings edit request. If the request was successful, the status will be "ok".'),
});

export function editVoiceSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_edit_voice_settings',
    description: 'Update voice settings',
    inputSchema: editVoiceSettingsInputSchema,
    outputSchema: editVoiceSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof editVoiceSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {};

      if (input.stability !== undefined) {
        data['stability'] = input.stability;
      }
      if (input.use_speaker_boost !== undefined) {
        data['use_speaker_boost'] = input.use_speaker_boost;
      }
      if (input.similarity_boost !== undefined) {
        data['similarity_boost'] = input.similarity_boost;
      }
      if (input.style !== undefined) {
        data['style'] = input.style;
      }
      if (input.speed !== undefined) {
        data['speed'] = input.speed;
      }

      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/voices/settings/update
        endpoint: `/v1/voices/${encodeURIComponent(input.voice_id)}/settings/edit`,
        data,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        status: providerResponse.status,
      };
    },
  });
}
