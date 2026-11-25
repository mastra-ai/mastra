// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  userId: z.string().describe('The ID of the user to retrieve. Example: "123456"'),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  url: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  time_zone: z.string().optional(),
  iana_time_zone: z.string().optional(),
  phone: z.string().nullable().optional(),
  locale: z.string().optional(),
  locale_id: z.number().optional(),
  organization_id: z.number().nullable().optional(),
  role: z.string().optional(),
  verified: z.boolean().optional(),
  active: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

export const getUserOutputSchema = z.object({
  id: z.number(),
  url: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  timeZone: z.string().optional(),
  ianaTimeZone: z.string().optional(),
  phone: z.string().optional(),
  locale: z.string().optional(),
  localeId: z.number().optional(),
  organizationId: z.number().optional(),
  role: z.string().optional(),
  verified: z.boolean().optional(),
  active: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_user',
    description: 'Retrieve a user by ID.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developer.zendesk.com/api-reference/ticketing/users/users/
        endpoint: `/api/v2/users/${encodeURIComponent(input.userId)}.json`,
        retries: 3,
      });

      if (!response.data || !response.data.user) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `User with ID ${input.userId} not found`,
        });
      }

      const providerUser = ProviderUserSchema.parse(response.data.user);

      return {
        id: providerUser.id,
        ...(providerUser.url !== undefined && { url: providerUser.url }),
        ...(providerUser.name !== undefined && { name: providerUser.name }),
        ...(providerUser.email !== undefined && { email: providerUser.email }),
        ...(providerUser.created_at !== undefined && { createdAt: providerUser.created_at }),
        ...(providerUser.updated_at !== undefined && { updatedAt: providerUser.updated_at }),
        ...(providerUser.time_zone !== undefined && { timeZone: providerUser.time_zone }),
        ...(providerUser.iana_time_zone !== undefined && { ianaTimeZone: providerUser.iana_time_zone }),
        ...(providerUser.phone != null && { phone: providerUser.phone }),
        ...(providerUser.locale !== undefined && { locale: providerUser.locale }),
        ...(providerUser.locale_id !== undefined && { localeId: providerUser.locale_id }),
        ...(providerUser.organization_id != null && { organizationId: providerUser.organization_id }),
        ...(providerUser.role !== undefined && { role: providerUser.role }),
        ...(providerUser.verified !== undefined && { verified: providerUser.verified }),
        ...(providerUser.active !== undefined && { active: providerUser.active }),
        ...(providerUser.suspended !== undefined && { suspended: providerUser.suspended }),
      };
    },
  });
}
