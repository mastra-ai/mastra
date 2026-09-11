// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listConnectionsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  connection_type: z.string().optional(),
  domain: z.string().optional(),
  organization_id: z.string().optional(),
  search: z.string().optional(),
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

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(ResourceSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listConnectionsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
});

export function listConnectionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_connections',
    description: 'List WorkOS SSO connections.',
    inputSchema: listConnectionsInputSchema,
    outputSchema: listConnectionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listConnectionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/sso/connection
        endpoint: '/connections',
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.connection_type !== undefined && { connection_type: input.connection_type }),
          ...(input.domain !== undefined && { domain: input.domain }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.search !== undefined && { search: input.search }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
