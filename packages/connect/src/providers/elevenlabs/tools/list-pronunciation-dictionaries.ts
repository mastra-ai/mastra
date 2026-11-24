// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPronunciationDictionariesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const PronunciationDictionarySchema = z.object({
  id: z.string(),
  latest_version_id: z.string(),
  latest_version_rules_num: z.number(),
  name: z.string(),
  permission_on_resource: z.string(),
  created_by: z.string(),
  creation_time_unix: z.number(),
  archived_time_unix: z.number().nullable().optional(),
  description: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  pronunciation_dictionaries: z.array(PronunciationDictionarySchema),
  next_cursor: z.string().optional().nullable(),
  has_more: z.boolean().optional(),
});

export const listPronunciationDictionariesOutputSchema = z.object({
  pronunciation_dictionaries: z.array(PronunciationDictionarySchema),
  next_cursor: z.string().optional(),
});

export function listPronunciationDictionariesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_list_pronunciation_dictionaries',
    description: 'List pronunciation dictionaries.',
    inputSchema: listPronunciationDictionariesInputSchema,
    outputSchema: listPronunciationDictionariesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPronunciationDictionariesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/list
        endpoint: '/v1/pronunciation-dictionaries',
        params: {
          ...(input.cursor !== undefined && { cursor: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        pronunciation_dictionaries: providerResponse.pronunciation_dictionaries,
        ...(providerResponse.next_cursor != null && { next_cursor: providerResponse.next_cursor }),
      };
    },
  });
}
