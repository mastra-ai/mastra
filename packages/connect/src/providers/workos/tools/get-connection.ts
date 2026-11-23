// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getConnectionInputSchema = z.object({ connection_id: z.string() });

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

export const getConnectionOutputSchema = ResourceSchema;

export function getConnectionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_connection',
    description: 'Get a WorkOS SSO connection.',
    inputSchema: getConnectionInputSchema,
    outputSchema: getConnectionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getConnectionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/sso/connection
        endpoint: `/connections/${encodeURIComponent(input.connection_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
