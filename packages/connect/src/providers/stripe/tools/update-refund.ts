// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateRefundInputSchema = z.object({
  id: z.string().describe('The ID of the refund to update. Example: "re_3TbSqaEZpD6kXrae0EGbSIG6"'),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs to attach to the refund.'),
});

const ProviderRefundSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  balance_transaction: z.string().nullable(),
  charge: z.string().nullable(),
  created: z.number(),
  currency: z.string(),
  metadata: z.record(z.string(), z.string()).nullable(),
  payment_intent: z.string().nullable(),
  reason: z.string().nullable(),
  receipt_number: z.string().nullable(),
  status: z.string(),
  source_transfer_reversal: z.string().nullable().optional(),
  transfer_reversal: z.string().nullable().optional(),
  destination_details: z.unknown().nullable().optional(),
});

export const updateRefundOutputSchema = z.object({
  id: z.string(),
  amount: z.number(),
  balance_transaction: z.string().optional(),
  charge: z.string().optional(),
  created: z.number(),
  currency: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
  payment_intent: z.string().optional(),
  reason: z.string().optional(),
  receipt_number: z.string().optional(),
  status: z.string(),
  source_transfer_reversal: z.string().optional(),
  transfer_reversal: z.string().optional(),
});

export function updateRefundTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_refund',
    description: 'Update a refund in Stripe.',
    inputSchema: updateRefundInputSchema,
    outputSchema: updateRefundOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateRefundOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params = new URLSearchParams();
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          params.append(`metadata[${key}]`, value);
        }
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/refunds/update
        endpoint: `/v1/refunds/${encodeURIComponent(input.id)}`,
        data: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const refund = ProviderRefundSchema.parse(response.data);

      return {
        id: refund.id,
        amount: refund.amount,
        ...(refund.balance_transaction != null && { balance_transaction: refund.balance_transaction }),
        ...(refund.charge != null && { charge: refund.charge }),
        created: refund.created,
        currency: refund.currency,
        ...(refund.metadata != null && { metadata: refund.metadata }),
        ...(refund.payment_intent != null && { payment_intent: refund.payment_intent }),
        ...(refund.reason != null && { reason: refund.reason }),
        ...(refund.receipt_number != null && { receipt_number: refund.receipt_number }),
        status: refund.status,
        ...(refund.source_transfer_reversal != null && { source_transfer_reversal: refund.source_transfer_reversal }),
        ...(refund.transfer_reversal != null && { transfer_reversal: refund.transfer_reversal }),
      };
    },
  });
}
