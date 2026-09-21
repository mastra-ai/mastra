// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSubscriptionInputSchema = z.object({
  id: z.string().describe('The ID of the subscription to delete. Example: sub_xxx'),
});

const ProviderSubscriptionSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  object: z.string().optional(),
});

export const deleteSubscriptionOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
});

export function deleteSubscriptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_subscription',
    description: 'Delete or archive a subscription in Stripe.',
    inputSchema: deleteSubscriptionInputSchema,
    outputSchema: deleteSubscriptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSubscriptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.stripe.com/api/subscriptions/delete
        endpoint: `/v1/subscriptions/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      const providerSubscription = ProviderSubscriptionSchema.parse(response.data);

      return {
        id: providerSubscription.id,
        ...(providerSubscription.status !== undefined && { status: providerSubscription.status }),
      };
    },
  });
}
