// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const revokeSessionInputSchema = z.object({ session_id: z.string() });

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

export const revokeSessionOutputSchema = ResourceSchema;

export function revokeSessionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_revoke_session',
    description: 'Revoke a Clerk session.',
    inputSchema: revokeSessionInputSchema,
    outputSchema: revokeSessionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof revokeSessionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Sessions#operation/RevokeSession
        endpoint: `/v1/sessions/${encodeURIComponent(input.session_id)}/revoke`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
