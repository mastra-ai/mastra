// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateConnectionInputSchema = z.object({
  connection_id: z.string(),
  name: z.string().optional(),
  external_id: z.string().max(128).nullable().optional(),
  connection_type: z.string().optional(),
});

const ResourceSchema = z
  .object({
    object: z.literal('connection'),
    id: z.string(),
    organization_id: z.string().optional(),
    connection_type: z.string(),
    name: z.string(),
    state: z.enum(['requires_type', 'draft', 'active', 'validating', 'inactive', 'deleting']),
    status: z.enum(['linked', 'unlinked']),
    domains: z.array(
      z.object({ id: z.string(), object: z.literal('connection_domain'), domain: z.string() }).passthrough(),
    ),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const updateConnectionOutputSchema = ResourceSchema;

export function updateConnectionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_update_connection',
    description: 'Update a WorkOS SSO connection.',
    inputSchema: updateConnectionInputSchema,
    outputSchema: updateConnectionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateConnectionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://workos.com/docs/reference/sso/connection
        endpoint: `/connections/${encodeURIComponent(input.connection_id)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.connection_type !== undefined && { connection_type: input.connection_type }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
