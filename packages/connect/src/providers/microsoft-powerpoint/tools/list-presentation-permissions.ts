// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPresentationPermissionsInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the presentation. Example: b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0',
    ),
  itemId: z.string().describe('The ID of the presentation item. Example: 01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ'),
});

const IdentitySchema = z.object({
  displayName: z.string().optional(),
  id: z.string().optional(),
  email: z.string().optional(),
});

const GrantedToSchema = z.object({
  user: IdentitySchema.optional(),
});

const IdentitySetV2Schema = z.object({
  user: IdentitySchema.optional(),
  application: IdentitySchema.optional(),
  device: IdentitySchema.optional(),
  siteUser: IdentitySchema.optional(),
  siteGroup: IdentitySchema.optional(),
  group: IdentitySchema.optional(),
});

const LinkSchema = z.object({
  type: z.string().optional(),
  scope: z.string().optional(),
  webUrl: z.string().optional(),
});

const ItemReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
});

const PermissionSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  grantedTo: GrantedToSchema.optional(),
  grantedToIdentities: z.array(GrantedToSchema).optional(),
  grantedToV2: IdentitySetV2Schema.optional(),
  grantedToIdentitiesV2: z.array(IdentitySetV2Schema).optional(),
  link: LinkSchema.optional(),
  hasPassword: z.boolean().optional(),
  expirationDateTime: z.string().optional(),
  inheritedFrom: ItemReferenceSchema.optional(),
});

export const listPresentationPermissionsOutputSchema = z.object({
  permissions: z.array(PermissionSchema),
});

export function listPresentationPermissionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_list_presentation_permissions',
    description: 'List sharing permissions on a presentation.',
    inputSchema: listPresentationPermissionsInputSchema,
    outputSchema: listPresentationPermissionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPresentationPermissionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get<unknown>({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-list-permissions
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/permissions`,
        retries: 3,
      });

      const rawData = response.data;
      if (!rawData || typeof rawData !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Microsoft Graph permissions endpoint.',
        });
      }

      const responseSchema = z.object({
        value: z.array(z.unknown()),
      });

      const parsedResponse = responseSchema.safeParse(rawData);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Provider response is missing the expected permissions collection.',
          details: parsedResponse.error.issues,
        });
      }
      const value = parsedResponse.data.value;

      const permissions = value.map((item: unknown) => {
        const parsed = PermissionSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Failed to parse a permission object from the provider response.',
            details: parsed.error.issues,
          });
        }
        return parsed.data;
      });

      return {
        permissions,
      };
    },
  });
}
