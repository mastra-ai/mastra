// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSetupIntentInputSchema = z.object({
  id: z.string().describe('The ID of the SetupIntent to retrieve. Example: seti_1TbSoQEZpD6kXraey8RhA0h1'),
});

export const getSetupIntentOutputSchema = z.object({}).passthrough();

export function getSetupIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_setup_intent',
    description: 'Retrieve a single setup intent from Stripe.',
    inputSchema: getSetupIntentInputSchema,
    outputSchema: getSetupIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSetupIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/setup_intents/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/setup_intents/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'SetupIntent not found',
          id: input.id,
        });
      }

      return getSetupIntentOutputSchema.parse(response.data);
    },
  });
}
