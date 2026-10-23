// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationInputSchema = z.object({
  organization_id: z.string().min(1).describe('WorkOS organization ID. Example: "org_01H..."'),
});

const DomainSchema = z.object({
  object: z.literal('organization_domain'),
  id: z.string(),
  domain: z.string(),
  organization_id: z.string(),
  state: z.string(),
  verification_token: z.string().optional(),
  verification_strategy: z.string(),
  verification_prefix: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const getOrganizationOutputSchema = z
  .object({
    object: z.literal('organization'),
    id: z.string(),
    name: z.string(),
    allow_profiles_outside_organization: z.boolean(),
    domains: z.array(DomainSchema),
    stripe_customer_id: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    external_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export function getOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_organization',
    description: 'Retrieve a WorkOS organization by ID.',
    inputSchema: getOrganizationInputSchema,
    outputSchema: getOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/organization
        endpoint: `/organizations/${encodeURIComponent(input.organization_id)}`,
        retries: 3,
      });
      return getOrganizationOutputSchema.parse(response.data);
    },
  });
}
