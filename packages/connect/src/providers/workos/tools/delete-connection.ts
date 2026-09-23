// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteConnectionInputSchema = z.object({ connection_id: z.string() });

export const deleteConnectionOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteConnectionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_connection',
    description: 'Delete a WorkOS SSO connection.',
    inputSchema: deleteConnectionInputSchema,
    outputSchema: deleteConnectionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteConnectionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/sso/connection
        endpoint: `/connections/${encodeURIComponent(input.connection_id)}`,
        retries: 3,
      });
      return { id: input.connection_id, success: true };
    },
  });
}
