// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserSubscriptionInputSchema = z.object({});

const OverageSchema = z.object({
  amount: z.string(),
  currency: z.string(),
});

const InvoiceSchema = z.object({
  amount_due_cents: z.number(),
  next_payment_attempt_unix: z.number(),
  discounts: z
    .array(
      z.object({
        discount_percent_off: z.number().optional(),
      }),
    )
    .nullable()
    .optional(),
  payment_intent_status: z.string().nullable().optional(),
  payment_intent_statusses: z.array(z.string()).nullable().optional(),
  subtotal_cents: z.number().nullable().optional(),
  tax_cents: z.number().nullable().optional(),
});

const ProviderSubscriptionSchema = z.object({
  tier: z.string(),
  character_count: z.number(),
  character_limit: z.number(),
  max_character_limit_extension: z.number().nullable().optional(),
  max_credit_limit_extension: z.number().nullable().optional(),
  can_extend_character_limit: z.boolean(),
  allowed_to_extend_character_limit: z.boolean(),
  voice_slots_used: z.number(),
  professional_voice_slots_used: z.number(),
  voice_limit: z.number(),
  voice_add_edit_counter: z.number(),
  professional_voice_limit: z.number(),
  can_extend_voice_limit: z.boolean(),
  can_use_instant_voice_cloning: z.boolean(),
  can_use_professional_voice_cloning: z.boolean(),
  current_overage: OverageSchema,
  status: z.string().nullable().optional(),
  has_open_invoices: z.boolean().nullable().optional(),
  next_character_count_reset_unix: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  billing_period: z.string().nullable().optional(),
  character_refresh_period: z.string().nullable().optional(),
  next_invoice: InvoiceSchema.nullable().optional(),
  open_invoices: z.array(InvoiceSchema).nullable().optional(),
  pending_change: z.record(z.string(), z.unknown()).nullable().optional(),
  has_used_starter_coupon_on_account: z.boolean().nullable().optional(),
  has_used_creator_coupon_on_account: z.boolean().nullable().optional(),
});

export const getUserSubscriptionOutputSchema = z.object({
  tier: z.string(),
  character_count: z.number(),
  character_limit: z.number(),
  max_character_limit_extension: z.number().optional(),
  max_credit_limit_extension: z.number().optional(),
  can_extend_character_limit: z.boolean(),
  allowed_to_extend_character_limit: z.boolean(),
  voice_slots_used: z.number(),
  professional_voice_slots_used: z.number(),
  voice_limit: z.number(),
  voice_add_edit_counter: z.number(),
  professional_voice_limit: z.number(),
  can_extend_voice_limit: z.boolean(),
  can_use_instant_voice_cloning: z.boolean(),
  can_use_professional_voice_cloning: z.boolean(),
  current_overage: OverageSchema,
  status: z.string().optional(),
  has_open_invoices: z.boolean().optional(),
  next_character_count_reset_unix: z.number().optional(),
  currency: z.string().optional(),
  billing_period: z.string().optional(),
  character_refresh_period: z.string().optional(),
  next_invoice: InvoiceSchema.optional(),
  open_invoices: z.array(InvoiceSchema).optional(),
  pending_change: z.record(z.string(), z.unknown()).optional(),
  has_used_starter_coupon_on_account: z.boolean().optional(),
  has_used_creator_coupon_on_account: z.boolean().optional(),
});

export function getUserSubscriptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_user_subscription',
    description: 'Get subscription details.',
    inputSchema: getUserSubscriptionInputSchema,
    outputSchema: getUserSubscriptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserSubscriptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/user-subscription/get
        endpoint: '/v1/user/subscription',
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Subscription details not found',
        });
      }

      const s = ProviderSubscriptionSchema.parse(response.data);

      return {
        tier: s.tier,
        character_count: s.character_count,
        character_limit: s.character_limit,
        max_character_limit_extension: s.max_character_limit_extension ?? undefined,
        max_credit_limit_extension: s.max_credit_limit_extension ?? undefined,
        can_extend_character_limit: s.can_extend_character_limit,
        allowed_to_extend_character_limit: s.allowed_to_extend_character_limit,
        voice_slots_used: s.voice_slots_used,
        professional_voice_slots_used: s.professional_voice_slots_used,
        voice_limit: s.voice_limit,
        voice_add_edit_counter: s.voice_add_edit_counter,
        professional_voice_limit: s.professional_voice_limit,
        can_extend_voice_limit: s.can_extend_voice_limit,
        can_use_instant_voice_cloning: s.can_use_instant_voice_cloning,
        can_use_professional_voice_cloning: s.can_use_professional_voice_cloning,
        current_overage: s.current_overage,
        status: s.status ?? undefined,
        has_open_invoices: s.has_open_invoices ?? undefined,
        next_character_count_reset_unix: s.next_character_count_reset_unix ?? undefined,
        currency: s.currency ?? undefined,
        billing_period: s.billing_period ?? undefined,
        character_refresh_period: s.character_refresh_period ?? undefined,
        next_invoice: s.next_invoice ?? undefined,
        open_invoices: s.open_invoices ?? undefined,
        pending_change: s.pending_change ?? undefined,
        has_used_starter_coupon_on_account: s.has_used_starter_coupon_on_account ?? undefined,
        has_used_creator_coupon_on_account: s.has_used_creator_coupon_on_account ?? undefined,
      };
    },
  });
}
