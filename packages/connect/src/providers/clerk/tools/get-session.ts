// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSessionInputSchema = z.object({ session_id: z.string() });

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    client_id: z.string().optional(),
    user_id: z.string(),
    status: z.enum(['abandoned', 'active', 'ended', 'expired', 'removed', 'replaced', 'revoked']).optional(),
    last_active_at: z.number().optional(),
    expire_at: z.number().optional(),
    abandon_at: z.number().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const getSessionOutputSchema = ResourceSchema;

export function getSessionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_session',
    description: 'Get a Clerk session.',
    inputSchema: getSessionInputSchema,
    outputSchema: getSessionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSessionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Sessions#operation/GetSession
        endpoint: `/v1/sessions/${encodeURIComponent(input.session_id)}`,
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
