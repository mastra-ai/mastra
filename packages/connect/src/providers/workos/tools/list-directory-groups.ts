// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDirectoryGroupsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  directory: z.string().optional().describe('Filter groups by directory ID.'),
  user: z.string().optional().describe('Filter groups by directory user ID.'),
});

const DirectoryGroupSchema = z
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

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(DirectoryGroupSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listDirectoryGroupsOutputSchema = z.object({
  items: z.array(DirectoryGroupSchema),
  next_cursor: z.string().optional(),
});

export function listDirectoryGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_directory_groups',
    description: 'List directory groups from WorkOS Directory Sync.',
    inputSchema: listDirectoryGroupsInputSchema,
    outputSchema: listDirectoryGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDirectoryGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/directory-sync/group
        endpoint: '/directory_groups',
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.directory !== undefined && { directory: input.directory }),
          ...(input.user !== undefined && { user: input.user }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
