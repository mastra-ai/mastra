// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateUserInputSchema = z.object({
  userId: z.string().describe('The ID of the user to update. Example: "123456789"'),
  name: z.string().optional().describe("The user's full name."),
  email: z
    .string()
    .optional()
    .describe("The user's email address. On update, adds as secondary email if primary is verified."),
  alias: z.string().optional().describe('An alias displayed to end users.'),
  details: z.string().optional().describe('Any details you want to store about the user, such as an address.'),
  notes: z.string().optional().describe('Any notes you want to store about the user.'),
  phone: z.string().optional().describe("The user's primary phone number."),
  organizationId: z
    .number()
    .optional()
    .describe(
      "The ID of the organization to make the user's only organization. Removes the user from every other organization they belong to.",
    ),
  role: z.enum(['end-user', 'agent', 'admin']).optional().describe("The user's role."),
  customRoleId: z.number().optional().describe('A custom role ID if the user is an agent on Enterprise plan.'),
  defaultGroupId: z.number().optional().describe("The ID of the user's default group."),
  externalId: z.string().optional().describe('A unique identifier from another system.'),
  localeId: z.number().optional().describe('The language identifier for this user.'),
  timeZone: z.string().optional().describe('The time-zone of this user. Example: "America/New_York".'),
  verified: z.boolean().optional().describe("Whether any of the user's identities is verified."),
  suspended: z.boolean().optional().describe('If the agent is suspended.'),
  userFields: z.record(z.string(), z.unknown()).optional().describe("Custom fields values for the user's profile."),
  tags: z.array(z.string()).optional().describe("The user's tags."),
  remotePhotoUrl: z.string().optional().describe("A URL pointing to the user's profile picture."),
  signature: z.string().optional().describe("The user's signature."),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  alias: z.string().nullish(),
  details: z.string().nullish(),
  notes: z.string().nullish(),
  phone: z.string().nullish(),
  organization_id: z.number().nullish(),
  role: z.string().nullish(),
  custom_role_id: z.number().nullish(),
  default_group_id: z.number().nullish(),
  external_id: z.string().nullish(),
  locale_id: z.number().nullish(),
  time_zone: z.string().nullish(),
  verified: z.boolean().nullish(),
  suspended: z.boolean().nullish(),
  user_fields: z.record(z.string(), z.unknown()).nullish(),
  tags: z.array(z.string()).nullish(),
  remote_photo_url: z.string().nullish(),
  signature: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  url: z.string().nullish(),
});

export const updateUserOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  alias: z.string().optional(),
  details: z.string().optional(),
  notes: z.string().optional(),
  phone: z.string().optional(),
  organizationId: z.number().optional(),
  role: z.string().optional(),
  customRoleId: z.number().optional(),
  defaultGroupId: z.number().optional(),
  externalId: z.string().optional(),
  localeId: z.number().optional(),
  timeZone: z.string().optional(),
  verified: z.boolean().optional(),
  suspended: z.boolean().optional(),
  userFields: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  remotePhotoUrl: z.string().optional(),
  signature: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  url: z.string().optional(),
});

export function updateUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_update_user',
    description: 'Update an existing user.',
    inputSchema: updateUserInputSchema,
    outputSchema: updateUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userData: Record<string, unknown> = {};

      if (input.name !== undefined) {
        userData['name'] = input.name;
      }
      if (input.email !== undefined) {
        userData['email'] = input.email;
      }
      if (input.alias !== undefined) {
        userData['alias'] = input.alias;
      }
      if (input.details !== undefined) {
        userData['details'] = input.details;
      }
      if (input.notes !== undefined) {
        userData['notes'] = input.notes;
      }
      if (input.phone !== undefined) {
        userData['phone'] = input.phone;
      }
      if (input.organizationId !== undefined) {
        userData['organization_id'] = input.organizationId;
      }
      if (input.role !== undefined) {
        userData['role'] = input.role;
      }
      if (input.customRoleId !== undefined) {
        userData['custom_role_id'] = input.customRoleId;
      }
      if (input.defaultGroupId !== undefined) {
        userData['default_group_id'] = input.defaultGroupId;
      }
      if (input.externalId !== undefined) {
        userData['external_id'] = input.externalId;
      }
      if (input.localeId !== undefined) {
        userData['locale_id'] = input.localeId;
      }
      if (input.timeZone !== undefined) {
        userData['time_zone'] = input.timeZone;
      }
      if (input.verified !== undefined) {
        userData['verified'] = input.verified;
      }
      if (input.suspended !== undefined) {
        userData['suspended'] = input.suspended;
      }
      if (input.userFields !== undefined) {
        userData['user_fields'] = input.userFields;
      }
      if (input.tags !== undefined) {
        userData['tags'] = input.tags;
      }
      if (input.remotePhotoUrl !== undefined) {
        userData['remote_photo_url'] = input.remotePhotoUrl;
      }
      if (input.signature !== undefined) {
        userData['signature'] = input.signature;
      }

      // https://developer.zendesk.com/api-reference/ticketing/users/users/#update-user
      const response = await platformProxy.put({
        endpoint: `/api/v2/users/${encodeURIComponent(input.userId)}.json`,
        data: {
          user: userData,
        },
        retries: 1,
      });

      const user = ProviderUserSchema.parse(response.data.user);

      return {
        id: String(user.id),
        ...(user.name != null && { name: user.name }),
        ...(user.email != null && { email: user.email }),
        ...(user.alias != null && { alias: user.alias }),
        ...(user.details != null && { details: user.details }),
        ...(user.notes != null && { notes: user.notes }),
        ...(user.phone != null && { phone: user.phone }),
        ...(user.organization_id != null && { organizationId: user.organization_id }),
        ...(user.role != null && { role: user.role }),
        ...(user.custom_role_id != null && { customRoleId: user.custom_role_id }),
        ...(user.default_group_id != null && { defaultGroupId: user.default_group_id }),
        ...(user.external_id != null && { externalId: user.external_id }),
        ...(user.locale_id != null && { localeId: user.locale_id }),
        ...(user.time_zone != null && { timeZone: user.time_zone }),
        ...(user.verified != null && { verified: user.verified }),
        ...(user.suspended != null && { suspended: user.suspended }),
        ...(user.user_fields != null && { userFields: user.user_fields }),
        ...(user.tags != null && { tags: user.tags }),
        ...(user.remote_photo_url != null && { remotePhotoUrl: user.remote_photo_url }),
        ...(user.signature != null && { signature: user.signature }),
        ...(user.created_at != null && { createdAt: user.created_at }),
        ...(user.updated_at != null && { updatedAt: user.updated_at }),
        ...(user.url != null && { url: user.url }),
      };
    },
  });
}
