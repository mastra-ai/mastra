// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DomainDataSchema = z.object({ domain: z.string(), state: z.enum(['verified', 'pending']) });

export const createOrganizationInputSchema = z.object({
  name: z.string().min(1).describe('Descriptive organization name.'),
  domain_data: z.array(DomainDataSchema).optional(),
  external_id: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createOrganizationOutputSchema = z
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

export function createOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_create_organization',
    description: 'Create an organization in WorkOS.',
    inputSchema: createOrganizationInputSchema,
    outputSchema: createOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/organization
        endpoint: '/organizations',
        data: {
          name: input.name,
          ...(input.domain_data !== undefined && { domain_data: input.domain_data }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
        retries: 3,
      });
      return createOrganizationOutputSchema.parse(response.data);
    },
  });
}
