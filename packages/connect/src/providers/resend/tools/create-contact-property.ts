// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const KeySchema = z
  .string()
  .max(50)
  .regex(/^[A-Za-z0-9_]+$/, { message: 'Only alphanumeric characters and underscores are allowed' })
  .describe('Property key of up to 50 alphanumeric or underscore characters. Example: "plan"');

export const createContactPropertyInputSchema = z
  .object({
    body: z.discriminatedUnion('type', [
      z.object({ key: KeySchema, type: z.literal('string'), fallback_value: z.string().optional() }).passthrough(),
      z.object({ key: KeySchema, type: z.literal('number'), fallback_value: z.number().optional() }).passthrough(),
    ]),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createContactPropertyOutputSchema = ProviderResponseSchema;

export function createContactPropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_contact_property',
    description: 'Create a new contact property in Resend.',
    inputSchema: createContactPropertyInputSchema,
    outputSchema: createContactPropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createContactPropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contact-properties`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
