// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removePronunciationDictionaryRulesInputSchema = z.object({
  pronunciation_dictionary_id: z
    .string()
    .describe('The ID of the pronunciation dictionary. Example: "pronunciation_dictionary_id"'),
  rule_strings: z
    .array(z.string())
    .describe('List of strings to remove from the pronunciation dictionary. Example: ["tomato", "Tomato"]'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  version_id: z.string(),
  version_rules_num: z.number(),
});

export const removePronunciationDictionaryRulesOutputSchema = z.object({
  id: z.string(),
  version_id: z.string(),
  version_rules_num: z.number(),
});

export function removePronunciationDictionaryRulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_remove_pronunciation_dictionary_rules',
    description: 'Remove rules from a pronunciation dictionary.',
    inputSchema: removePronunciationDictionaryRulesInputSchema,
    outputSchema: removePronunciationDictionaryRulesOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof removePronunciationDictionaryRulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/remove
        endpoint: `/v1/pronunciation-dictionaries/${encodeURIComponent(input.pronunciation_dictionary_id)}/remove-rules`,
        data: {
          rule_strings: input.rule_strings,
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        version_id: providerResponse.version_id,
        version_rules_num: providerResponse.version_rules_num,
      };
    },
  });
}
