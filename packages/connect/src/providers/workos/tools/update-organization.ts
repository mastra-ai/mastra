// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DomainDataSchema = z.object({ domain: z.string(), state: z.enum(['verified', 'pending']) });

export const updateOrganizationInputSchema = z.object({
  organization_id: z.string().min(1).describe('WorkOS organization ID. Example: "org_01H..."'),
  name: z.string().optional(),
  domain_data: z.array(DomainDataSchema).optional(),
  stripe_customer_id: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const updateOrganizationOutputSchema = z
  .object({
    object: z.literal('organization'),
    id: z.string(),
    name: z.string(),
    allow_profiles_outside_organization: z.boolean(),
    domains: z.array(z.record(z.string(), z.unknown())),
    stripe_customer_id: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    external_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export function updateOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_update_organization',
    description: 'Update a WorkOS organization.',
    inputSchema: updateOrganizationInputSchema,
    outputSchema: updateOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://workos.com/docs/reference/organization
        endpoint: `/organizations/${encodeURIComponent(input.organization_id)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.domain_data !== undefined && { domain_data: input.domain_data }),
          ...(input.stripe_customer_id !== undefined && { stripe_customer_id: input.stripe_customer_id }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
        retries: 3,
      });
      return updateOrganizationOutputSchema.parse(response.data);
    },
  });
}
