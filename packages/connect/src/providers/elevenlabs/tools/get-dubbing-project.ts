// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDubbingProjectInputSchema = z.object({
  dubbing_id: z.string().describe('ID of the dubbing project. Example: "21m00Tcm4TlvDq8ikWAM"'),
});

const DubbingMediaMetadataSchema = z.object({
  content_type: z.string(),
  duration: z.number(),
});

const ProviderDubbingMetadataSchema = z.object({
  dubbing_id: z.string(),
  name: z.string(),
  status: z.string(),
  source_language: z.string().nullable(),
  target_languages: z.array(z.string()),
  editable: z.boolean().optional(),
  created_at: z.string(),
  media_metadata: DubbingMediaMetadataSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

export const getDubbingProjectOutputSchema = z.object({
  dubbing_id: z.string(),
  name: z.string(),
  status: z.string(),
  source_language: z.string().optional(),
  target_languages: z.array(z.string()),
  editable: z.boolean().optional(),
  created_at: z.string(),
  media_metadata: DubbingMediaMetadataSchema.optional(),
  error: z.string().optional(),
});

export function getDubbingProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_dubbing_project',
    description: 'Retrieve a dubbing project.',
    inputSchema: getDubbingProjectInputSchema,
    outputSchema: getDubbingProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDubbingProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/dubbing/get
        endpoint: `/v1/dubbing/${encodeURIComponent(input.dubbing_id)}`,
        retries: 3,
      });

      const providerData = ProviderDubbingMetadataSchema.parse(response.data);

      return {
        dubbing_id: providerData.dubbing_id,
        name: providerData.name,
        status: providerData.status,
        target_languages: providerData.target_languages,
        created_at: providerData.created_at,
        ...(providerData.source_language != null && { source_language: providerData.source_language }),
        ...(providerData.editable !== undefined && { editable: providerData.editable }),
        ...(providerData.media_metadata != null && { media_metadata: providerData.media_metadata }),
        ...(providerData.error != null && { error: providerData.error }),
      };
    },
  });
}
