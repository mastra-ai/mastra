// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDirectoryGroupInputSchema = z.object({ group_id: z.string() });

const ResourceSchema = z
  .object({
    id: z.string(),
    idp_id: z.string(),
    directory_id: z.string(),
    organization_id: z.string().nullable(),
    name: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    raw_attributes: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const getDirectoryGroupOutputSchema = ResourceSchema;

export function getDirectoryGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_directory_group',
    description: 'Get a WorkOS directory group.',
    inputSchema: getDirectoryGroupInputSchema,
    outputSchema: getDirectoryGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDirectoryGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/directory-sync/group
        endpoint: `/directory_groups/${encodeURIComponent(input.group_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
