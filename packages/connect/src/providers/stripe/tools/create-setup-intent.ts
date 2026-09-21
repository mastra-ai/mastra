// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AutomaticPaymentMethodsSchema = z.object({
  enabled: z.boolean().optional().describe('Whether this feature is enabled'),
  allow_redirects: z
    .enum(['always', 'never'])
    .optional()
    .describe('Controls whether this SetupIntent will accept redirect-based payment methods'),
});

export const createSetupIntentInputSchema = z.object({
  customer: z.string().optional().describe('ID of the Customer this SetupIntent belongs to. Example: "cus_xxx"'),
  description: z.string().optional().describe('An arbitrary string attached to the object'),
  confirm: z.boolean().optional().describe('Set to true to attempt to confirm this SetupIntent immediately'),
  payment_method: z
    .string()
    .optional()
    .describe('ID of the payment method to attach to this SetupIntent. Example: "pm_xxx"'),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs to attach to the object'),
  automatic_payment_methods: AutomaticPaymentMethodsSchema.optional().describe('Configure automatic payment methods'),
  usage: z.enum(['on_session', 'off_session']).optional().describe('How the SetupIntent will be used'),
});

const ProviderSetupIntentSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    status: z.string(),
    client_secret: z.string().optional().nullable(),
    customer: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    usage: z.string().optional().nullable(),
    created: z.number(),
  })
  .passthrough();

export const createSetupIntentOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  status: z.string(),
  client_secret: z.string().optional(),
  customer_id: z.string().optional(),
  description: z.string().optional(),
  payment_method_id: z.string().optional(),
  usage: z.string().optional(),
  created_at: z.number(),
});

export function createSetupIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_setup_intent',
    description: 'Create a setup intent in Stripe.',
    inputSchema: createSetupIntentInputSchema,
    outputSchema: createSetupIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSetupIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params = new URLSearchParams();

      if (input.customer !== undefined) {
        params.set('customer', input.customer);
      }
      if (input.description !== undefined) {
        params.set('description', input.description);
      }
      if (input.confirm !== undefined) {
        params.set('confirm', String(input.confirm));
      }
      if (input.payment_method !== undefined) {
        params.set('payment_method', input.payment_method);
      }
      if (input.usage !== undefined) {
        params.set('usage', input.usage);
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          params.set(`metadata[${key}]`, value);
        }
      }
      if (input.automatic_payment_methods !== undefined) {
        if (input.automatic_payment_methods.enabled !== undefined) {
          params.set('automatic_payment_methods[enabled]', String(input.automatic_payment_methods.enabled));
        }
        if (input.automatic_payment_methods.allow_redirects !== undefined) {
          params.set('automatic_payment_methods[allow_redirects]', input.automatic_payment_methods.allow_redirects);
        }
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/setup_intents/create
        endpoint: '/v1/setup_intents',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: params.toString(),
        retries: 3,
      });

      const providerSetupIntent = ProviderSetupIntentSchema.parse(response.data);

      return {
        id: providerSetupIntent.id,
        object: providerSetupIntent.object,
        status: providerSetupIntent.status,
        ...(providerSetupIntent.client_secret != null && { client_secret: providerSetupIntent.client_secret }),
        ...(providerSetupIntent.customer != null && { customer_id: providerSetupIntent.customer }),
        ...(providerSetupIntent.description != null && { description: providerSetupIntent.description }),
        ...(providerSetupIntent.payment_method != null && { payment_method_id: providerSetupIntent.payment_method }),
        ...(providerSetupIntent.usage != null && { usage: providerSetupIntent.usage }),
        created_at: providerSetupIntent.created,
      };
    },
  });
}
