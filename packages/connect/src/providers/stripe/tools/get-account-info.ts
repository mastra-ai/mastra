// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getAccountInfoInputSchema = z.object({});

export const getAccountInfoOutputSchema = z
  .object({
    id: z.string(),
    object: z.literal('account'),
    business_profile: z
      .object({
        mcc: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        product_description: z.string().nullable().optional(),
        support_address: z.unknown().nullable().optional(),
        support_email: z.string().nullable().optional(),
        support_phone: z.string().nullable().optional(),
        support_url: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    business_type: z.string().nullable().optional(),
    capabilities: z.record(z.string(), z.string()).optional(),
    charges_enabled: z.boolean().optional(),
    country: z.string().optional(),
    created: z.number().optional(),
    default_currency: z.string().optional(),
    details_submitted: z.boolean().optional(),
    email: z.string().nullable().optional(),
    payouts_enabled: z.boolean().optional(),
    settings: z.unknown().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export function getAccountInfoTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_account_info',
    description:
      'Retrieve the Stripe account information for the connected account, including name, country, currency, and enabled capabilities.',
    inputSchema: getAccountInfoInputSchema,
    outputSchema: getAccountInfoOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAccountInfoOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/accounts/retrieve
        endpoint: '/v1/account',
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const account = getAccountInfoOutputSchema.parse(response.data);

      return account;
    },
  });
}
