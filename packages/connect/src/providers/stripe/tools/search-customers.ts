// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchCustomersInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Stripe search query. Supports field-scoped clauses like email:"jane@example.com", name~"jane" (substring), or metadata["key"]:"value". See https://stripe.com/docs/search#search-query-language.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('A limit on the number of objects to be returned. Between 1 and 100, default 10.'),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from the previous response. Maps to Stripe's page parameter. Omit for first page."),
});

const CustomerSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  created: z.number().optional(),
  currency: z.string().nullable().optional(),
  delinquent: z.boolean().nullable().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const searchCustomersOutputSchema = z.object({
  customers: z.array(CustomerSchema),
  next_cursor: z.string().optional(),
  total_count: z.number().optional(),
});

export function searchCustomersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_search_customers',
    description:
      "Search Stripe customers by email, name, or metadata using Stripe's search query language instead of paging the full customer list. New customers can take up to a minute to become searchable.",
    inputSchema: searchCustomersInputSchema,
    outputSchema: searchCustomersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchCustomersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);

      // https://docs.stripe.com/api/customers/search
      const response = await platformProxy.get({
        endpoint: '/v1/customers/search',
        params: {
          query: input.query,
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.cursor !== undefined && { page: input.cursor }),
        },
        retries: 3,
      });

      const data = response.data;

      const customers = (data.data || []).map((customer: any) => ({
        id: customer.id,
        email: customer.email ?? undefined,
        name: customer.name ?? undefined,
        description: customer.description ?? undefined,
        created: customer.created,
        currency: customer.currency ?? undefined,
        delinquent: customer.delinquent ?? undefined,
        livemode: customer.livemode,
        metadata: customer.metadata,
      }));

      return {
        customers,
        ...(data.has_more && data.next_page && { next_cursor: data.next_page }),
        ...(data.total_count !== undefined && { total_count: data.total_count }),
      };
    },
  });
}
