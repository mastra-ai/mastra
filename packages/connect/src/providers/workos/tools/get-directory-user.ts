// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDirectoryUserInputSchema = z.object({ directory_user_id: z.string() });

const GroupSchema = z
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

const ResourceSchema = z
  .object({
    object: z.literal('directory_user'),
    id: z.string(),
    directory_id: z.string(),
    organization_id: z.string().nullable(),
    idp_id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    state: z.enum(['active', 'inactive']),
    role: z.record(z.string(), z.unknown()).optional(),
    roles: z.array(z.record(z.string(), z.unknown())).optional(),
    raw_attributes: z.record(z.string(), z.unknown()),
    custom_attributes: z.record(z.string(), z.unknown()).optional(),
    groups: z.array(GroupSchema),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const getDirectoryUserOutputSchema = ResourceSchema;

export function getDirectoryUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_directory_user',
    description: 'Get a WorkOS directory user and their groups.',
    inputSchema: getDirectoryUserInputSchema,
    outputSchema: getDirectoryUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDirectoryUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/directory-sync/user
        endpoint: `/directory_users/${encodeURIComponent(input.directory_user_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
