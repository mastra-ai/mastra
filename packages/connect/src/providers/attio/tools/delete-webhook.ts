// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWebhookInputSchema = z.object({
  webhook_id: z
    .string()
    .describe('The unique identifier of the webhook to delete. Example: "45662666-3a96-4189-9ddb-6d6fe20bd076"'),
});

export const deleteWebhookOutputSchema = z.object({
  webhook_id: z.string().describe('The ID of the deleted webhook'),
  deleted: z.boolean().describe('Whether the webhook was successfully deleted'),
});

export function deleteWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_webhook',
    description: 'Delete or archive a webhook in Attio',
    inputSchema: deleteWebhookInputSchema,
    outputSchema: deleteWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/reference/delete_webhooks_webhook_id
      await platformProxy.delete({
        endpoint: `/v2/webhooks/${input.webhook_id}`,
        retries: 3,
      });

      return {
        webhook_id: input.webhook_id,
        deleted: true,
      };
    },
  });
}
