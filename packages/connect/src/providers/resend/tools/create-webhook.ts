// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';
import { withoutSecretFields } from '../../../runtime/redact.js';

export const createWebhookInputSchema = z
  .object({ body: z.object({ endpoint: z.string(), events: z.array(z.string()).min(1) }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z
  .object({ object: z.string().optional(), id: z.string().optional(), signing_secret: z.string().optional() })
  .passthrough();

export const createWebhookOutputSchema = ProviderResponseSchema;

/** Provider secrets removed before the result leaves the tool. */
export const createWebhookOutputSchemaRedacted = createWebhookOutputSchema.omit({ signing_secret: true });

export function createWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_webhook',
    description: 'Create a new webhook in Resend.',
    inputSchema: createWebhookInputSchema,
    outputSchema: createWebhookOutputSchemaRedacted,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createWebhookOutputSchemaRedacted>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof createWebhookOutputSchema>> => {
        const config: PlatformProxyRequest = {
          // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
          endpoint: `/webhooks`,
          retries: 0,
          data: input.body,
        };
        const response = await platformProxy.post(config);
        const data = ProviderResponseSchema.parse(response.data);
        return data;
      })();
      return withoutSecretFields(result, ['signing_secret']);
    },
  });
}
