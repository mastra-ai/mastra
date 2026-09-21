// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createRefundInputSchema = z.object({
  payment_intent: z.string().optional().describe('The identifier of the PaymentIntent to refund. Example: "pi_xxx"'),
  charge: z.string().optional().describe('The identifier of the charge to refund. Example: "ch_xxx"'),
  amount: z
    .number()
    .int()
    .optional()
    .describe('A positive integer in the smallest currency unit representing how much of this charge to refund.'),
  reason: z
    .union([z.literal('duplicate'), z.literal('fraudulent'), z.literal('requested_by_customer')])
    .optional()
    .describe('Reason for the refund.'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Set of key-value pairs for storing additional information.'),
  refund_application_fee: z.boolean().optional().describe('Whether the application fee should be refunded.'),
  reverse_transfer: z
    .boolean()
    .optional()
    .describe('Whether the transfer should be reversed when refunding this charge.'),
  instructions_email: z
    .string()
    .optional()
    .describe('Email for refund instructions for payment methods without native refund support.'),
  origin: z
    .literal('customer_balance')
    .optional()
    .describe('Origin of the refund. If provided, a Charge or PaymentIntent identifier is not required.'),
});

const DestinationDetailsCardSchema = z.object({
  reference: z.string().optional(),
  reference_status: z.string().optional(),
  reference_type: z.string().optional(),
  type: z.string().optional(),
});

const DestinationDetailsSchema = z.object({
  card: DestinationDetailsCardSchema.optional(),
  type: z.string().optional(),
});

export const createRefundOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  balance_transaction: z.string().nullable().optional(),
  charge: z.string().nullable().optional(),
  created: z.number(),
  currency: z.string(),
  destination_details: DestinationDetailsSchema.nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  payment_intent: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  receipt_number: z.string().nullable().optional(),
  source_transfer_reversal: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  transfer_reversal: z.string().nullable().optional(),
});

export function createRefundTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_refund',
    description: 'Create a refund in Stripe.',
    inputSchema: createRefundInputSchema,
    outputSchema: createRefundOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createRefundOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (!input.payment_intent && !input.charge && !input.origin) {
        throw new platformProxy.ActionError({
          type: 'missing_required_parameter',
          message: 'One of payment_intent, charge, or origin is required to create a refund.',
        });
      }

      const data = new URLSearchParams();

      if (input.payment_intent !== undefined) {
        data.set('payment_intent', input.payment_intent);
      }
      if (input.charge !== undefined) {
        data.set('charge', input.charge);
      }
      if (input.amount !== undefined) {
        data.set('amount', String(input.amount));
      }
      if (input.reason !== undefined) {
        data.set('reason', input.reason);
      }
      if (input.refund_application_fee !== undefined) {
        data.set('refund_application_fee', String(input.refund_application_fee));
      }
      if (input.reverse_transfer !== undefined) {
        data.set('reverse_transfer', String(input.reverse_transfer));
      }
      if (input.instructions_email !== undefined) {
        data.set('instructions_email', input.instructions_email);
      }
      if (input.origin !== undefined) {
        data.set('origin', input.origin);
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          data.set(`metadata[${key}]`, value);
        }
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/refunds/create
        endpoint: '/v1/refunds',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data.toString(),
        retries: 3,
      });

      const refund = createRefundOutputSchema.parse(response.data);

      return refund;
    },
  });
}
