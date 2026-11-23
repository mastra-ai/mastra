// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  external_id: z.string().nullable().optional(),
  locale: z.string().optional(),
  time_zone: z.string().optional(),
  verified: z.boolean().optional(),
});

const ProviderMetaSchema = z.object({
  has_more: z.boolean().optional(),
  after_cursor: z.string().nullish(),
  before_cursor: z.string().nullish(),
});

const ProviderLinksSchema = z.object({
  next: z.string().nullish(),
  prev: z.string().nullish(),
});

const ProviderResponseSchema = z.object({
  users: z.array(ProviderUserSchema),
  meta: ProviderMetaSchema.optional(),
  links: ProviderLinksSchema.optional(),
});

const UserSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  external_id: z.string().optional(),
  locale: z.string().optional(),
  time_zone: z.string().optional(),
  verified: z.boolean().optional(),
});

export const listUsersOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_users',
    description: 'List users in Zendesk Support.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {
        'page[size]': '100',
      };

      if (input.cursor) {
        params['page[after]'] = input.cursor;
      }

      // https://developer.zendesk.com/api-reference/ticketing/users/users/
      const response = await platformProxy.get({
        endpoint: '/api/v2/users.json',
        params: params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const items = providerData.users.map(user => ({
        id: user.id,
        ...(user.name !== undefined && { name: user.name }),
        ...(user.email !== undefined && { email: user.email }),
        ...(user.role !== undefined && { role: user.role }),
        ...(user.active !== undefined && { active: user.active }),
        ...(user.created_at !== undefined && { created_at: user.created_at }),
        ...(user.updated_at !== undefined && { updated_at: user.updated_at }),
        ...(user.external_id !== undefined && user.external_id !== null && { external_id: user.external_id }),
        ...(user.locale !== undefined && { locale: user.locale }),
        ...(user.time_zone !== undefined && { time_zone: user.time_zone }),
        ...(user.verified !== undefined && { verified: user.verified }),
      }));

      const next_cursor =
        providerData.meta?.has_more && providerData.meta?.after_cursor ? providerData.meta.after_cursor : undefined;

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
