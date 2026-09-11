// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDirectoryInputSchema = z.object({ directory_id: z.string() });

const ResourceSchema = z
  .object({
    object: z.literal('directory'),
    id: z.string(),
    domain: z.string(),
    external_key: z.string(),
    name: z.string(),
    organization_id: z.string().nullable().optional(),
    state: z.string(),
    type: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const getDirectoryOutputSchema = ResourceSchema;

export function getDirectoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_directory',
    description: 'Get a WorkOS directory.',
    inputSchema: getDirectoryInputSchema,
    outputSchema: getDirectoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDirectoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/directory-sync/directory
        endpoint: `/directories/${encodeURIComponent(input.directory_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
