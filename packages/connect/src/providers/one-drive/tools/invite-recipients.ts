// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DriveRecipientSchema = z.object({
  email: z.string().email().optional().describe('Email address of the recipient. Example: "ryan@contoso.com"'),
  objectId: z.string().uuid().optional().describe('The unique identifier of the recipient in Microsoft Entra ID.'),
  alias: z.string().optional().describe('The alias of the recipient. Example: "family" for a family sharing link.'),
});

export const inviteRecipientsInputSchema = z.object({
  itemId: z.string().describe('The ID of the drive item to share. Example: "0123456789ABC"'),
  recipients: z
    .array(DriveRecipientSchema)
    .min(1)
    .describe('A collection of recipients who receive access and the sharing invitation.'),
  roles: z
    .array(z.enum(['read', 'write']))
    .describe('The roles to grant to the recipients. Valid values: "read", "write"'),
  requireSignIn: z
    .boolean()
    .optional()
    .describe('Specifies whether the recipient must sign in to view the shared item.'),
  sendInvitation: z
    .boolean()
    .optional()
    .describe(
      'If true, sends a sharing link to the recipient. Otherwise, grants permission without sending a notification.',
    ),
  message: z
    .string()
    .max(2000)
    .optional()
    .describe('A plain text message included in the sharing invitation. Maximum length: 2,000 characters.'),
  password: z
    .string()
    .optional()
    .describe('The password set on the invite by the creator. Optional and OneDrive for home only.'),
  expirationDateTime: z.string().datetime().optional().describe('The dateTime after which the permission expires.'),
  retainInheritedPermissions: z
    .boolean()
    .optional()
    .describe('If true (default), any existing inherited permissions are retained when sharing for the first time.'),
});

const IdentitySchema = z.object({
  displayName: z.string().optional(),
  id: z.string().optional(),
});

const GrantedToV2Schema = z.object({
  user: IdentitySchema.optional(),
  siteUser: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
      loginName: z.string().optional(),
    })
    .optional(),
});

const InvitationSchema = z.object({
  email: z.string().optional(),
  signInRequired: z.boolean().optional(),
});

const ErrorDetailSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  localizedMessage: z.string().optional(),
  fixItUrl: z.string().url().optional(),
  innererror: z
    .object({
      code: z.string().optional(),
    })
    .optional(),
});

const PermissionSchema = z.object({
  id: z.string().optional(),
  grantedToV2: GrantedToV2Schema.optional(),
  grantedTo: z
    .object({
      user: IdentitySchema.optional(),
    })
    .optional(),
  hasPassword: z.boolean().optional(),
  invitation: InvitationSchema.optional(),
  roles: z.array(z.string()).optional(),
  expirationDateTime: z.string().datetime().optional(),
  error: ErrorDetailSchema.optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(PermissionSchema),
});

const RecipientResultSchema = z.object({
  id: z.string().optional(),
  grantedToUserId: z.string().uuid().optional(),
  grantedToUserDisplayName: z.string().optional(),
  invitationEmail: z.string().optional(),
  signInRequired: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
  hasPassword: z.boolean().optional(),
  expirationDateTime: z.string().datetime().optional(),
  hasError: z.boolean().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const inviteRecipientsOutputSchema = z.object({
  permissions: z.array(RecipientResultSchema),
});

export function inviteRecipientsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_invite_recipients',
    description: 'Grant item access to recipients and optionally send invitations.',
    inputSchema: inviteRecipientsInputSchema,
    outputSchema: inviteRecipientsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof inviteRecipientsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        recipients: input.recipients,
        roles: input.roles,
      };

      if (input.requireSignIn !== undefined) {
        requestBody['requireSignIn'] = input.requireSignIn;
      }
      if (input.sendInvitation !== undefined) {
        requestBody['sendInvitation'] = input.sendInvitation;
      }
      if (input.message !== undefined) {
        requestBody['message'] = input.message;
      }
      if (input.password !== undefined) {
        requestBody['password'] = input.password;
      }
      if (input.expirationDateTime !== undefined) {
        requestBody['expirationDateTime'] = input.expirationDateTime;
      }
      if (input.retainInheritedPermissions !== undefined) {
        requestBody['retainInheritedPermissions'] = input.retainInheritedPermissions;
      }

      const response = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/driveitem-invite
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/invite`,
        data: requestBody,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const permissions = providerResponse.value.map(permission => {
        const result: z.infer<typeof RecipientResultSchema> = {
          id: permission.id,
          roles: permission.roles,
        };

        if (permission.grantedToV2?.user?.id) {
          result.grantedToUserId = permission.grantedToV2.user.id;
        } else if (permission.grantedTo?.user?.id) {
          result.grantedToUserId = permission.grantedTo.user.id;
        }

        if (permission.grantedToV2?.user?.displayName) {
          result.grantedToUserDisplayName = permission.grantedToV2.user.displayName;
        } else if (permission.grantedTo?.user?.displayName) {
          result.grantedToUserDisplayName = permission.grantedTo.user.displayName;
        }

        if (permission.invitation?.email) {
          result.invitationEmail = permission.invitation.email;
        }
        if (permission.invitation?.signInRequired !== undefined) {
          result.signInRequired = permission.invitation.signInRequired;
        }
        if (permission.hasPassword !== undefined) {
          result.hasPassword = permission.hasPassword;
        }
        if (permission.expirationDateTime) {
          result.expirationDateTime = permission.expirationDateTime;
        }
        if (permission.error) {
          result.hasError = true;
          result.errorCode = permission.error.code;
          result.errorMessage = permission.error.message;
        }

        return result;
      });

      return { permissions };
    },
  });
}
