// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSharingLinkInputSchema = z.object({
  siteId: z
    .string()
    .describe('SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012"'),
  driveId: z.string().describe('Drive ID. Example: "b!1234567890abcdefghijklmnopqrstuvwxyz"'),
  itemId: z.string().describe('Drive item ID. Example: "0123456789abcdefghijklmnopqrstuvwxyz"'),
  type: z.enum(['view', 'edit', 'embed']).describe('The type of sharing link to create.'),
  scope: z.enum(['anonymous', 'organization']).describe('The scope of access granted by the sharing link.'),
});

const LinkSchema = z.object({
  type: z.string().optional(),
  scope: z.string().optional(),
  webUrl: z.string().optional(),
  preventsDownload: z.boolean().optional(),
});

const PermissionSchema = z.object({
  id: z.string().optional(),
  roles: z.array(z.string()).optional(),
  shareId: z.string().optional(),
  hasPassword: z.boolean().optional(),
  link: LinkSchema.optional(),
});

export const createSharingLinkOutputSchema = z.object({
  id: z.string().optional(),
  roles: z.array(z.string()).optional(),
  shareId: z.string().optional(),
  hasPassword: z.boolean().optional(),
  link: z
    .object({
      type: z.string().optional(),
      scope: z.string().optional(),
      webUrl: z.string().optional(),
      preventsDownload: z.boolean().optional(),
    })
    .optional(),
});

export function createSharingLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_create_sharing_link',
    description: 'Create a shareable link for a drive item.',
    inputSchema: createSharingLinkInputSchema,
    outputSchema: createSharingLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSharingLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/driveitem-createlink
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/createLink`,
        data: {
          type: input.type,
          scope: input.scope,
        },
        retries: 3,
      });

      const permission = PermissionSchema.parse(response.data);

      return {
        ...(permission.id !== undefined && { id: permission.id }),
        ...(permission.roles !== undefined && { roles: permission.roles }),
        ...(permission.shareId !== undefined && { shareId: permission.shareId }),
        ...(permission.hasPassword !== undefined && { hasPassword: permission.hasPassword }),
        ...(permission.link !== undefined && {
          link: {
            ...(permission.link.type !== undefined && { type: permission.link.type }),
            ...(permission.link.scope !== undefined && { scope: permission.link.scope }),
            ...(permission.link.webUrl !== undefined && { webUrl: permission.link.webUrl }),
            ...(permission.link.preventsDownload !== undefined && {
              preventsDownload: permission.link.preventsDownload,
            }),
          },
        }),
      };
    },
  });
}
