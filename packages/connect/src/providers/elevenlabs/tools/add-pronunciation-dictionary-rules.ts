// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AliasRuleSchema = z.object({
  type: z.literal('alias'),
  string_to_replace: z.string().min(1).describe('The string to replace. Must be a non-empty string.'),
  alias: z.string().describe('The alias for the string to be replaced.'),
  case_sensitive: z.boolean().optional().describe('Whether the rule should match case-sensitively. Default: true.'),
  word_boundaries: z
    .boolean()
    .optional()
    .describe('Whether the rule should only match at word boundaries. Default: true.'),
});

const PhonemeRuleSchema = z.object({
  type: z.literal('phoneme'),
  string_to_replace: z.string().min(1).describe('The string to replace. Must be a non-empty string.'),
  phoneme: z.string().describe('The phoneme rule.'),
  alphabet: z.string().describe('The alphabet to use with the phoneme rule.'),
  case_sensitive: z.boolean().optional().describe('Whether the rule should match case-sensitively. Default: true.'),
  word_boundaries: z
    .boolean()
    .optional()
    .describe('Whether the rule should only match at word boundaries. Default: true.'),
});

const RuleSchema = z.union([AliasRuleSchema, PhonemeRuleSchema]);

export const addPronunciationDictionaryRulesInputSchema = z.object({
  pronunciation_dictionary_id: z.string().describe('The ID of the pronunciation dictionary.'),
  rules: z.array(RuleSchema).describe('List of pronunciation rules to add.'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  version_id: z.string(),
  version_rules_num: z.number(),
});

export const addPronunciationDictionaryRulesOutputSchema = z.object({
  id: z.string().describe('The ID of the pronunciation dictionary.'),
  version_id: z.string().describe('The version ID of the pronunciation dictionary.'),
  version_rules_num: z.number().describe('The number of rules in the version of the pronunciation dictionary.'),
});

export function addPronunciationDictionaryRulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_add_pronunciation_dictionary_rules',
    description: 'Add rules to a pronunciation dictionary.',
    inputSchema: addPronunciationDictionaryRulesInputSchema,
    outputSchema: addPronunciationDictionaryRulesOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof addPronunciationDictionaryRulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/pronunciation-dictionaries/rules/add
        endpoint: `/v1/pronunciation-dictionaries/${encodeURIComponent(input.pronunciation_dictionary_id)}/add-rules`,
        data: {
          rules: input.rules,
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
