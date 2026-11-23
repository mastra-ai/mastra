// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPronunciationDictionaryInputSchema = z.object({
  pronunciation_dictionary_id: z.string().describe('The ID of the pronunciation dictionary. Example: "pdct_123456789"'),
});

const ProviderRuleSchema = z.object({
  string_to_replace: z.string(),
  case_sensitive: z.boolean().optional(),
  word_boundaries: z.boolean().optional(),
  type: z.string(),
  alias: z.string().optional(),
  phoneme: z.string().optional(),
  alphabet: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  latest_version_id: z.string(),
  latest_version_rules_num: z.number(),
  name: z.string(),
  permission_on_resource: z.string().nullable().optional(),
  created_by: z.string(),
  creation_time_unix: z.number(),
  archived_time_unix: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  rules: z.array(ProviderRuleSchema),
});

export const getPronunciationDictionaryOutputSchema = z.object({
  id: z.string(),
  latest_version_id: z.string(),
  latest_version_rules_num: z.number(),
  name: z.string(),
  permission_on_resource: z.string().optional(),
  created_by: z.string(),
  creation_time_unix: z.number(),
  archived_time_unix: z.number().optional(),
  description: z.string().optional(),
  rules: z.array(
    z.object({
      string_to_replace: z.string(),
      case_sensitive: z.boolean().optional(),
      word_boundaries: z.boolean().optional(),
      type: z.string(),
      alias: z.string().optional(),
      phoneme: z.string().optional(),
      alphabet: z.string().optional(),
    }),
  ),
});

export function getPronunciationDictionaryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_pronunciation_dictionary',
    description: 'Retrieve a pronunciation dictionary.',
    inputSchema: getPronunciationDictionaryInputSchema,
    outputSchema: getPronunciationDictionaryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPronunciationDictionaryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/get
        endpoint: `/v1/pronunciation-dictionaries/${encodeURIComponent(input.pronunciation_dictionary_id)}`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        latest_version_id: providerResponse.latest_version_id,
        latest_version_rules_num: providerResponse.latest_version_rules_num,
        name: providerResponse.name,
        ...(providerResponse.permission_on_resource != null && {
          permission_on_resource: providerResponse.permission_on_resource,
        }),
        created_by: providerResponse.created_by,
        creation_time_unix: providerResponse.creation_time_unix,
        ...(providerResponse.archived_time_unix != null && { archived_time_unix: providerResponse.archived_time_unix }),
        ...(providerResponse.description != null && { description: providerResponse.description }),
        rules: providerResponse.rules.map(rule => ({
          string_to_replace: rule.string_to_replace,
          ...(rule.case_sensitive != null && { case_sensitive: rule.case_sensitive }),
          ...(rule.word_boundaries != null && { word_boundaries: rule.word_boundaries }),
          type: rule.type,
          ...(rule.alias != null && { alias: rule.alias }),
          ...(rule.phoneme != null && { phoneme: rule.phoneme }),
          ...(rule.alphabet != null && { alphabet: rule.alphabet }),
        })),
      };
    },
  });
}
