// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSetupIntentsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
    ),
  customer: z
    .string()
    .optional()
    .describe('Only return SetupIntents for the customer specified by this customer ID. Example: "cus_xxx"'),
  payment_method: z
    .string()
    .optional()
    .describe('Only return SetupIntents that associate with the specified payment method. Example: "pm_xxx"'),
  attach_to_self: z
    .boolean()
    .optional()
    .describe("If present, the SetupIntent's payment method will be attached to the in-context Stripe Account."),
  created_after: z.number().int().optional().describe('Minimum value to filter by created timestamp (exclusive).'),
  created_before: z.number().int().optional().describe('Maximum value to filter by created timestamp (exclusive).'),
});

const SetupIntentSchema = z.object({
  id: z.string(),
  object: z.string(),
  status: z.string(),
  customer: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  created: z.number().int(),
  usage: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  payment_method_types: z.array(z.string()).nullable().optional(),
});

export const listSetupIntentsOutputSchema = z.object({
  items: z.array(SetupIntentSchema),
  next_cursor: z.string().optional(),
});

export function listSetupIntentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_setup_intents',
    description: 'List setup intents from Stripe.',
    inputSchema: listSetupIntentsInputSchema,
    outputSchema: listSetupIntentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSetupIntentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/setup_intents/list
        endpoint: '/v1/setup_intents',
        params: {
          ...(input.limit !== undefined && { limit: input.limit }),
          ...(input.customer !== undefined && { customer: input.customer }),
          ...(input.payment_method !== undefined && { payment_method: input.payment_method }),
          ...(input.attach_to_self !== undefined && { attach_to_self: String(input.attach_to_self) }),
          ...(input.cursor !== undefined && { starting_after: input.cursor }),
          ...(input.created_after !== undefined && { 'created[gt]': input.created_after }),
          ...(input.created_before !== undefined && { 'created[lt]': input.created_before }),
        },
        retries: 3,
      });

      const rawData = response.data;

      if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Stripe API',
        });
      }

      const setupIntents = rawData.data.map((item: unknown) => {
        const parsed = SetupIntentSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Failed to parse SetupIntent from Stripe API',
            details: parsed.error.message,
          });
        }
        return parsed.data;
      });

      const hasMore = rawData.has_more === true;
      const nextCursor = hasMore && setupIntents.length > 0 ? setupIntents[setupIntents.length - 1].id : undefined;

      return {
        items: setupIntents,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
