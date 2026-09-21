// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOwnerInputSchema = z.object({
  ownerId: z.string().describe('HubSpot owner ID. Example: "123"'),
});

export const getOwnerOutputSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function getOwnerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_owner',
    description: 'Get an owner by ID',
    inputSchema: getOwnerInputSchema,
    outputSchema: getOwnerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOwnerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.hubspot.com/docs/api-reference/crm-crm-owners-v3/owners/get-crm-v3-owners-ownerId
        endpoint: `/crm/v3/owners/${input.ownerId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Owner not found',
          ownerId: input.ownerId,
        });
      }

      const owner = response.data;

      return {
        id: owner.id,
        email: owner.email ?? undefined,
        firstName: owner.firstName ?? undefined,
        lastName: owner.lastName ?? undefined,
        userId: owner.userId ? String(owner.userId) : undefined,
        createdAt: owner.createdAt ?? undefined,
        updatedAt: owner.updatedAt ?? undefined,
      };
    },
  });
}
