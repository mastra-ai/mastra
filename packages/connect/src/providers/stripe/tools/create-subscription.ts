// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SubscriptionItemInputSchema = z.object({
  price: z.string().describe('The ID of the price object. Example: "price_1TbSoCEZpD6kXraexkCThz8o"'),
  quantity: z.number().optional().describe('Quantity for this item. Defaults to 1.'),
});

export const createSubscriptionInputSchema = z.object({
  customer: z.string().describe('The identifier of the customer to subscribe. Example: "cus_Uae6TTxHlP2hxk"'),
  items: z
    .array(SubscriptionItemInputSchema)
    .min(1)
    .describe('A list of subscription items, each with an attached price.'),
  default_payment_method: z
    .string()
    .optional()
    .describe('ID of the default payment method for the subscription. Example: "pm_1TbSoaEZpD6kXraeiNPSsDV1"'),
  collection_method: z
    .enum(['charge_automatically', 'send_invoice'])
    .optional()
    .describe('How to charge the subscription.'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Set of key-value pairs to attach to the subscription.'),
  trial_end: z.number().optional().describe('Unix timestamp representing the end of the trial period.'),
  cancel_at_period_end: z
    .boolean()
    .optional()
    .describe('Whether this subscription should cancel at the end of the current period.'),
  proration_behavior: z.enum(['create_prorations', 'none']).optional().describe('How to handle prorations.'),
  description: z.string().optional().describe('The subscription description.'),
});

const ProviderPriceSchema = z.object({
  id: z.string(),
  product: z.string(),
});

const ProviderSubscriptionItemSchema = z.object({
  id: z.string(),
  created: z.number(),
  current_period_end: z.number(),
  current_period_start: z.number(),
  metadata: z.record(z.string(), z.string()).optional(),
  price: ProviderPriceSchema,
  quantity: z.number(),
  subscription: z.string(),
});

const ProviderSubscriptionSchema = z.object({
  id: z.string(),
  object: z.string(),
  status: z.string(),
  customer: z.string(),
  created: z.number(),
  current_period_start: z.number().nullish(),
  current_period_end: z.number().nullish(),
  cancel_at_period_end: z.boolean(),
  canceled_at: z.number().nullish(),
  collection_method: z.string(),
  currency: z.string().nullish(),
  default_payment_method: z.string().nullish(),
  default_source: z.string().nullish(),
  description: z.string().nullish(),
  ended_at: z.number().nullish(),
  latest_invoice: z.string().nullish(),
  metadata: z.record(z.string(), z.string()).optional(),
  start_date: z.number().nullish(),
  trial_end: z.number().nullish(),
  trial_start: z.number().nullish(),
  items: z.object({
    object: z.string(),
    data: z.array(ProviderSubscriptionItemSchema),
    has_more: z.boolean(),
    total_count: z.number(),
    url: z.string(),
  }),
});

export const createSubscriptionOutputSchema = z.object({
  id: z.string().describe('The subscription ID.'),
  status: z.string().describe('The status of the subscription.'),
  customer: z.string().describe('The customer ID.'),
  created: z.number().describe('When the subscription was created.'),
  current_period_start: z.number().optional().describe('Start of the current period.'),
  current_period_end: z.number().optional().describe('End of the current period.'),
  cancel_at_period_end: z.boolean().describe('Whether the subscription cancels at period end.'),
  collection_method: z.string().describe('How the subscription is billed.'),
  currency: z.string().optional().describe('Three-letter ISO currency code.'),
  default_payment_method: z.string().optional().describe('Default payment method ID.'),
  default_source: z.string().optional().describe('Default payment source ID.'),
  description: z.string().optional().describe('Subscription description.'),
  ended_at: z.number().optional().describe('When the subscription ended.'),
  latest_invoice: z.string().optional().describe('The latest invoice ID.'),
  metadata: z.record(z.string(), z.string()).optional().describe('Key-value pairs attached to the subscription.'),
  start_date: z.number().optional().describe('When the subscription started.'),
  trial_end: z.number().optional().describe('End of the trial period.'),
  trial_start: z.number().optional().describe('Start of the trial period.'),
  items: z
    .array(
      z.object({
        id: z.string(),
        created: z.number(),
        current_period_end: z.number(),
        current_period_start: z.number(),
        price_id: z.string(),
        product_id: z.string(),
        quantity: z.number(),
        subscription: z.string(),
      }),
    )
    .describe('The subscription items.'),
});

export function createSubscriptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_subscription',
    description: 'Create a subscription in Stripe.',
    inputSchema: createSubscriptionInputSchema,
    outputSchema: createSubscriptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSubscriptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const formData: Record<string, string> = {
        customer: input.customer,
      };

      let index = 0;
      for (const item of input.items) {
        formData[`items[${index}][price]`] = item.price;
        if (item.quantity !== undefined) {
          formData[`items[${index}][quantity]`] = String(item.quantity);
        }
        index++;
      }

      if (input.default_payment_method !== undefined) {
        formData['default_payment_method'] = input.default_payment_method;
      }

      if (input.collection_method !== undefined) {
        formData['collection_method'] = input.collection_method;
      }

      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          formData[`metadata[${key}]`] = value;
        }
      }

      if (input.trial_end !== undefined) {
        formData['trial_end'] = String(input.trial_end);
      }

      if (input.cancel_at_period_end !== undefined) {
        formData['cancel_at_period_end'] = String(input.cancel_at_period_end);
      }

      if (input.proration_behavior !== undefined) {
        formData['proration_behavior'] = input.proration_behavior;
      }

      if (input.description !== undefined) {
        formData['description'] = input.description;
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/subscriptions/create
        endpoint: '/v1/subscriptions',
        data: new URLSearchParams(formData).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerSubscription = ProviderSubscriptionSchema.parse(response.data);

      return {
        id: providerSubscription.id,
        status: providerSubscription.status,
        customer: providerSubscription.customer,
        created: providerSubscription.created,
        ...(providerSubscription.current_period_start != null && {
          current_period_start: providerSubscription.current_period_start,
        }),
        ...(providerSubscription.current_period_end != null && {
          current_period_end: providerSubscription.current_period_end,
        }),
        cancel_at_period_end: providerSubscription.cancel_at_period_end,
        collection_method: providerSubscription.collection_method,
        ...(providerSubscription.currency != null && { currency: providerSubscription.currency }),
        ...(providerSubscription.default_payment_method != null && {
          default_payment_method: providerSubscription.default_payment_method,
        }),
        ...(providerSubscription.default_source != null && { default_source: providerSubscription.default_source }),
        ...(providerSubscription.description != null && { description: providerSubscription.description }),
        ...(providerSubscription.ended_at != null && { ended_at: providerSubscription.ended_at }),
        ...(providerSubscription.latest_invoice != null && { latest_invoice: providerSubscription.latest_invoice }),
        ...(providerSubscription.metadata !== undefined && { metadata: providerSubscription.metadata }),
        ...(providerSubscription.start_date != null && { start_date: providerSubscription.start_date }),
        ...(providerSubscription.trial_end != null && { trial_end: providerSubscription.trial_end }),
        ...(providerSubscription.trial_start != null && { trial_start: providerSubscription.trial_start }),
        items: providerSubscription.items.data.map(item => ({
          id: item.id,
          created: item.created,
          current_period_end: item.current_period_end,
          current_period_start: item.current_period_start,
          price_id: item.price.id,
          product_id: item.price.product,
          quantity: item.quantity,
          subscription: item.subscription,
        })),
      };
    },
  });
}
