// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { withoutSecretFields } from '../../../runtime/redact.js';

export const getUserInputSchema = z.object({});

const SubscriptionSchema = z.object({
  tier: z.string().optional(),
  character_count: z.number().optional(),
  character_limit: z.number().optional(),
  max_character_limit_extension: z.number().nullable().optional(),
  can_extend_character_limit: z.boolean().optional(),
  allowed_to_extend_character_limit: z.boolean().optional(),
  voice_slots_used: z.number().optional(),
  professional_voice_slots_used: z.number().optional(),
  voice_limit: z.number().optional(),
  voice_add_edit_counter: z.number().optional(),
  professional_voice_limit: z.number().optional(),
  can_extend_voice_limit: z.boolean().optional(),
  can_use_instant_voice_cloning: z.boolean().optional(),
  can_use_professional_voice_cloning: z.boolean().optional(),
  current_overage: z
    .object({
      amount: z.string(),
      currency: z.string(),
    })
    .nullable()
    .optional(),
  status: z.string().optional(),
  next_character_count_reset_unix: z.number().nullable().optional(),
  max_voice_add_edits: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  billing_period: z.string().nullable().optional(),
  character_refresh_period: z.string().nullable().optional(),
});

const ProviderUserSchema = z.object({
  user_id: z.string(),
  subscription: SubscriptionSchema.optional(),
  is_new_user: z.boolean().optional(),
  xi_api_key: z.string().nullable().optional(),
  can_use_delayed_payment_methods: z.boolean().optional(),
  is_onboarding_completed: z.boolean().optional(),
  is_onboarding_checklist_completed: z.boolean().optional(),
  show_compliance_terms: z.boolean().nullable().optional(),
  first_name: z.string().nullable().optional(),
  is_api_key_hashed: z.boolean().nullable().optional(),
  xi_api_key_preview: z.string().nullable().optional(),
  referral_link_code: z.string().nullable().optional(),
  partnerstack_partner_default_link: z.string().nullable().optional(),
  created_at: z.number().optional(),
  seat_type: z.string().optional(),
});

export const getUserOutputSchema = ProviderUserSchema;

/** Provider secrets removed before the result leaves the tool. */
export const getUserOutputSchemaRedacted = getUserOutputSchema.omit({ xi_api_key: true });

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_user',
    description: 'Get user/account details.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchemaRedacted,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchemaRedacted>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof getUserOutputSchema>> => {
        // https://elevenlabs.io/docs/api-reference/user/get
        const response = await platformProxy.get({
          endpoint: '/v1/user',
          retries: 3,
        });

        return ProviderUserSchema.parse(response.data);
      })();
      return withoutSecretFields(result, ['xi_api_key']);
    },
  });
}
