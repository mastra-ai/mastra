// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSharingLinkInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Item ID. Example: "01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ"'),
  type: z.enum(['view', 'edit']).describe('The type of sharing link to create.'),
  scope: z.enum(['organization', 'anonymous']).describe('The scope of the sharing link.'),
});

const ProviderApplicationSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
});

const ProviderLinkSchema = z.object({
  type: z.string().optional(),
  scope: z.string().optional(),
  webUrl: z.string().optional(),
  application: ProviderApplicationSchema.optional().nullable(),
});

const ProviderPermissionSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  link: ProviderLinkSchema.optional().nullable(),
});

export const createSharingLinkOutputSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  link: z
    .object({
      type: z.string().optional(),
      scope: z.string().optional(),
      webUrl: z.string().optional(),
      application: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export function createSharingLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_create_sharing_link',
    description: 'Create a sharing link for a presentation.',
    inputSchema: createSharingLinkInputSchema,
    outputSchema: createSharingLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSharingLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-createlink
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/createLink`,
        data: {
          type: input.type,
          scope: input.scope,
        },
        retries: 3,
      });

      const permission = ProviderPermissionSchema.parse(response.data);

      return {
        id: permission.id,
        ...(permission.roles !== undefined && { roles: permission.roles }),
        ...(permission.link != null && {
          link: {
            ...(permission.link.type !== undefined && { type: permission.link.type }),
            ...(permission.link.scope !== undefined && { scope: permission.link.scope }),
            ...(permission.link.webUrl !== undefined && { webUrl: permission.link.webUrl }),
            ...(permission.link.application != null && {
              application: {
                ...(permission.link.application.id !== undefined && { id: permission.link.application.id }),
                ...(permission.link.application.displayName !== undefined && {
                  displayName: permission.link.application.displayName,
                }),
              },
            }),
          },
        }),
      };
    },
  });
}
