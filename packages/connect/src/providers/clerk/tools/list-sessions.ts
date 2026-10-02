// AUTO-GENERATED from NangoHQ/integration-templates @ 23df553a789b — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSessionsInputSchema = z
  .object({
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor returned by a previous request. Omit for the first page.'),
    limit: z.number().int().min(1).max(500).optional(),
    client_id: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
    status: z.enum(['abandoned', 'active', 'ended', 'expired', 'removed', 'replaced', 'revoked']).optional(),
  })
  .refine(value => value.client_id !== undefined || value.user_id !== undefined, {
    message: 'Provide at least one of client_id or user_id.',
  });

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    client_id: z.string().optional(),
    user_id: z.string(),
    status: z
      .enum(['abandoned', 'active', 'ended', 'expired', 'removed', 'replaced', 'revoked'])
      .or(z.string())
      .optional(),
    last_active_at: z.number().optional(),
    expire_at: z.number().optional(),
    abandon_at: z.number().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.array(ResourceSchema);

export const listSessionsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
});

export function listSessionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_list_sessions',
    description: 'List Clerk sessions.',
    inputSchema: listSessionsInputSchema,
    outputSchema: listSessionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSessionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor === undefined ? 0 : /^\d+$/.test(input.cursor) ? Number(input.cursor) : Number.NaN;
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a non-negative integer.',
        });
      const limit = input.limit ?? 10;
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Sessions#operation/GetSessionList
        endpoint: '/v1/sessions',
        params: {
          offset: String(offset),
          limit: String(limit),
          ...(input.client_id !== undefined && { client_id: input.client_id }),
          ...(input.user_id !== undefined && { user_id: input.user_id }),
          ...(input.status !== undefined && { status: input.status }),
        },
        retries: 3,
      });
      const sessions = ProviderResponseSchema.parse(response.data);
      return { items: sessions, ...(sessions.length === limit && { next_cursor: String(offset + sessions.length) }) };
    },
  });
}
