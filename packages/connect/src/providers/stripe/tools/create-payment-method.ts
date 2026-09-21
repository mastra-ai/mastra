// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPaymentMethodInputSchema = z.object({
  type: z.string().describe('The type of the PaymentMethod. Example: "card"'),
  card: z
    .object({
      token: z.string().optional().describe('Stripe token for the card. Example: "tok_visa"'),
    })
    .optional(),
  billing_details: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z
        .object({
          city: z.string().optional(),
          country: z.string().optional(),
          line1: z.string().optional(),
          line2: z.string().optional(),
          postal_code: z.string().optional(),
          state: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const AddressSchema = z.object({
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  line1: z.string().nullable().optional(),
  line2: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const BillingDetailsSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: AddressSchema.optional(),
});

const ProviderPaymentMethodSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  type: z.string(),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
  customer: z.string().nullable().optional(),
  billing_details: BillingDetailsSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createPaymentMethodOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
  customer: z.string().nullable().optional(),
  billing_details: BillingDetailsSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export function createPaymentMethodTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_payment_method',
    description: 'Create a payment method in Stripe.',
    inputSchema: createPaymentMethodInputSchema,
    outputSchema: createPaymentMethodOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPaymentMethodOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, string> = {
        type: input.type,
      };

      if (input.card !== undefined && input.card.token !== undefined) {
        data['card[token]'] = input.card.token;
      }

      if (input.billing_details !== undefined) {
        if (input.billing_details.name !== undefined) {
          data['billing_details[name]'] = input.billing_details.name;
        }
        if (input.billing_details.email !== undefined) {
          data['billing_details[email]'] = input.billing_details.email;
        }
        if (input.billing_details.phone !== undefined) {
          data['billing_details[phone]'] = input.billing_details.phone;
        }
        if (input.billing_details.address !== undefined) {
          const address = input.billing_details.address;
          if (address.city !== undefined) {
            data['billing_details[address][city]'] = address.city;
          }
          if (address.country !== undefined) {
            data['billing_details[address][country]'] = address.country;
          }
          if (address.line1 !== undefined) {
            data['billing_details[address][line1]'] = address.line1;
          }
          if (address.line2 !== undefined) {
            data['billing_details[address][line2]'] = address.line2;
          }
          if (address.postal_code !== undefined) {
            data['billing_details[address][postal_code]'] = address.postal_code;
          }
          if (address.state !== undefined) {
            data['billing_details[address][state]'] = address.state;
          }
        }
      }

      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          data[`metadata[${key}]`] = value;
        }
      }

      // https://docs.stripe.com/api/payment_methods/create
      const response = await platformProxy.post({
        endpoint: '/v1/payment_methods',
        data: new URLSearchParams(data).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerPaymentMethod = ProviderPaymentMethodSchema.parse(response.data);

      return {
        id: providerPaymentMethod.id,
        type: providerPaymentMethod.type,
        ...(providerPaymentMethod.created !== undefined && { created: providerPaymentMethod.created }),
        ...(providerPaymentMethod.livemode !== undefined && { livemode: providerPaymentMethod.livemode }),
        ...(providerPaymentMethod.customer !== undefined && { customer: providerPaymentMethod.customer }),
        ...(providerPaymentMethod.billing_details !== undefined && {
          billing_details: providerPaymentMethod.billing_details,
        }),
        ...(providerPaymentMethod.metadata !== undefined && { metadata: providerPaymentMethod.metadata }),
      };
    },
  });
}
