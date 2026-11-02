// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSharingLinkInputSchema = z.object({
  itemId: z.string().describe('The ID of the driveItem to share. Example: "01X2Y3Z4ABC5DEF6G7H8I9J0K"'),
  type: z
    .enum(['view', 'edit', 'embed'])
    .describe('The type of sharing link to create. view: read-only, edit: read-write, embed: embeddable link.'),
  scope: z
    .enum(['anonymous', 'organization'])
    .optional()
    .describe(
      'The scope of the sharing link. anonymous: anyone with the link, organization: only organization members.',
    ),
  password: z.string().optional().describe('Optional password for the sharing link.'),
  expirationDateTime: z
    .string()
    .optional()
    .describe('Optional expiration date/time in ISO 8601 format. Example: "2026-12-31T23:59:59Z"'),
});

const ProviderLinkSchema = z.object({
  type: z.string().optional(),
  scope: z.string().optional(),
  webUrl: z.string().optional(),
  webHtml: z.string().optional(),
  application: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  preAuthorizedApplications: z
    .array(
      z.object({
        appId: z.string().optional(),
        delegatedPermissionId: z.string().optional(),
      }),
    )
    .optional(),
});

const ProviderPermissionSchema = z.object({
  id: z.string().optional(),
  link: ProviderLinkSchema.nullable().optional(),
  roles: z.array(z.string()).optional(),
  shareId: z.string().optional(),
});

export const createSharingLinkOutputSchema = z.object({
  id: z.string().optional(),
  shareId: z.string().optional(),
  webUrl: z.string().optional(),
  type: z.string().optional(),
  scope: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export function createSharingLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_create_sharing_link',
    description: 'Create a share link for a file or folder.',
    inputSchema: createSharingLinkInputSchema,
    outputSchema: createSharingLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSharingLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        type: input.type,
      };

      if (input.scope !== undefined) {
        requestBody['scope'] = input.scope;
      }
      if (input.password !== undefined) {
        requestBody['password'] = input.password;
      }
      if (input.expirationDateTime !== undefined) {
        requestBody['expirationDateTime'] = input.expirationDateTime;
      }

      // https://learn.microsoft.com/graph/api/driveitem-createlink
      const response = await platformProxy.post({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/createLink`,
        data: requestBody,
        retries: 3,
      });

      const permission = ProviderPermissionSchema.parse(response.data);

      const link = permission.link;

      return {
        ...(permission.id !== undefined && { id: permission.id }),
        ...(permission.shareId !== undefined && { shareId: permission.shareId }),
        ...(link?.webUrl !== undefined && { webUrl: link.webUrl }),
        ...(link?.type !== undefined && { type: link.type }),
        ...(link?.scope !== undefined && { scope: link.scope }),
        ...(permission.roles !== undefined && { roles: permission.roles }),
      };
    },
  });
}
