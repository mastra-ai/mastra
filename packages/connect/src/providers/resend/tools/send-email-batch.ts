// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const BatchEmailSchema = z
  .object({
    from: z.string(),
    to: z.union([z.string(), z.array(z.string()).min(1).max(50)]),
    subject: z.string(),
    bcc: z.union([z.string(), z.array(z.string())]).optional(),
    cc: z.union([z.string(), z.array(z.string())]).optional(),
    reply_to: z.union([z.string(), z.array(z.string())]).optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    template: z
      .object({ id: z.string(), variables: z.record(z.string(), z.union([z.string(), z.number()])).optional() })
      .passthrough()
      .optional(),
    headers: z.object({}).passthrough().optional(),
    scheduled_at: z.string().optional(),
    attachments: z
      .array(
        z
          .object({
            content: z.string().optional(),
            filename: z.string().optional(),
            path: z.string().optional(),
            content_type: z.string().optional(),
            content_id: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    tags: z.array(z.object({ name: z.string(), value: z.string() }).passthrough()).optional(),
    topic_id: z.string().optional(),
  })
  .passthrough()
  .refine(
    email =>
      email.template ? email.html === undefined && email.text === undefined : Boolean(email.html || email.text),
    {
      message: 'Provide html or text, or a template without html/text',
    },
  );

export const sendEmailBatchInputSchema = z
  .object({
    idempotency_key: z.string().min(1).max(256).optional(),
    body: z.array(BatchEmailSchema).min(1).max(100),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({ data: z.array(z.object({ id: z.string().optional() }).passthrough()).optional() })
  .passthrough();

export const sendEmailBatchOutputSchema = ProviderResponseSchema;

export function sendEmailBatchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_send_email_batch',
    description: 'Trigger up to 100 batch emails at once in Resend.',
    inputSchema: sendEmailBatchInputSchema,
    outputSchema: sendEmailBatchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendEmailBatchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.idempotency_key !== undefined) {
        const keyedConfig: PlatformProxyRequest = {
          // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
          endpoint: `/emails/batch`,
          retries: 3,
          headers: { 'Idempotency-Key': input.idempotency_key },
          data: input.body,
        };
        const response = await platformProxy.post(keyedConfig);
        return ProviderResponseSchema.parse(response.data);
      }
      const unkeyedConfig: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/batch`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(unkeyedConfig);
      return ProviderResponseSchema.parse(response.data);
    },
  });
}
