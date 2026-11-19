// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteVoiceInputSchema = z.object({
  voice_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'Voice IDs contain only letters, digits, underscores, and hyphens.')
    .describe('ID of the voice to delete. Example: "c38kUX8pkfYO2kHyqfFy"'),
});

const ProviderResponseSchema = z.object({ status: z.string() }).passthrough();

export const deleteVoiceOutputSchema = z.object({
  status: z.string().describe('"ok" when the voice was deleted.'),
});

export function deleteVoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_voice',
    description: 'Delete a voice you own, such as a voice clone, from the voice library.',
    inputSchema: deleteVoiceInputSchema,
    outputSchema: deleteVoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteVoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://elevenlabs.io/docs/api-reference/voices/delete
        endpoint: `/v1/voices/${encodeURIComponent(input.voice_id)}`,
        retries: 3,
      });
      return { status: ProviderResponseSchema.parse(response.data).status };
    },
  });
}
