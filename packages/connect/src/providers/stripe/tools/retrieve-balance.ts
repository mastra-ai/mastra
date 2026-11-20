// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const retrieveBalanceInputSchema = z.object({});

const BalanceAmountSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    source_types: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export const retrieveBalanceOutputSchema = z
  .object({
    object: z.literal('balance'),
    available: z.array(BalanceAmountSchema),
    pending: z.array(BalanceAmountSchema),
    connect_reserved: z.array(BalanceAmountSchema).optional(),
    instant_available: z
      .array(BalanceAmountSchema.extend({ net_available: z.array(z.unknown()).optional() }))
      .optional(),
    livemode: z.boolean(),
  })
  .passthrough();

export function retrieveBalanceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_retrieve_balance',
    description:
      'Retrieve the current account balance from Stripe, broken down by available and pending funds per currency.',
    inputSchema: retrieveBalanceInputSchema,
    outputSchema: retrieveBalanceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveBalanceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/balance/balance_retrieve
        endpoint: '/v1/balance',
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const balance = retrieveBalanceOutputSchema.parse(response.data);

      return balance;
    },
  });
}
