// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';
import { withoutSecretFields } from '../../../runtime/redact.js';

export const getWebhookInputSchema = z.object({ webhook_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    endpoint: z.string().optional(),
    events: z.array(z.string()).nullable().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
    signing_secret: z.string().optional(),
  })
  .passthrough();

export const getWebhookOutputSchema = ProviderResponseSchema;

/** Provider secrets removed before the result leaves the tool. */
export const getWebhookOutputSchemaRedacted = getWebhookOutputSchema.omit({ signing_secret: true });

export function getWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_webhook',
    description: 'Retrieve a single webhook in Resend.',
    inputSchema: getWebhookInputSchema,
    outputSchema: getWebhookOutputSchemaRedacted,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWebhookOutputSchemaRedacted>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof getWebhookOutputSchema>> => {
        const config: PlatformProxyRequest = {
          // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
          endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}`,
          retries: 3,
        };
        const response = await platformProxy.get(config);
        const data = ProviderResponseSchema.parse(response.data);
        return data;
      })();
      return withoutSecretFields(result, ['signing_secret']);
    },
  });
}
