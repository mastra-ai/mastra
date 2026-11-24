// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPermissionGroupsInputSchema = z.object({
  cursor: z
    .string()
    .min(1)
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().int().min(1).max(100).optional().describe('Number of groups per page. Maximum is 100.'),
});

const ProviderPermissionGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  built_in: z.boolean().optional(),
  publish: z.array(z.number()).optional(),
  edit: z.array(z.number()).optional(),
});

const ProviderResponseSchema = z.object({
  permission_groups: z.array(ProviderPermissionGroupSchema),
  meta: z.object({ has_more: z.boolean().optional(), after_cursor: z.string().nullable().optional() }).optional(),
});

export const listPermissionGroupsOutputSchema = z.object({
  permission_groups: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      built_in: z.boolean().optional(),
      publish: z.array(z.number()).optional().describe('IDs of the user groups that can publish articles.'),
      edit: z.array(z.number()).optional().describe('IDs of the user groups that can edit articles.'),
    }),
  ),
  next_cursor: z.string().optional(),
});

export function listPermissionGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_permission_groups',
    description:
      'List Help Center permission groups, which decide who can edit and publish articles. Creating an article needs one.',
    inputSchema: listPermissionGroupsInputSchema,
    outputSchema: listPermissionGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPermissionGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/permission_groups/#list-permission-groups
      const response = await platformProxy.get({
        endpoint: '/api/v2/guide/permission_groups',
        params: {
          'page[size]': String(input.page_size ?? 100),
          ...(input.cursor !== undefined && { 'page[after]': input.cursor }),
        },
        retries: 3,
      });
      const data = ProviderResponseSchema.parse(response.data);
      return {
        permission_groups: data.permission_groups.map(group => ({
          id: group.id,
          name: group.name,
          ...(group.built_in !== undefined && { built_in: group.built_in }),
          ...(group.publish !== undefined && { publish: group.publish }),
          ...(group.edit !== undefined && { edit: group.edit }),
        })),
        ...(data.meta?.has_more && data.meta.after_cursor ? { next_cursor: data.meta.after_cursor } : {}),
      };
    },
  });
}
