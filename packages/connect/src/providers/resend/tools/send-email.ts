// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const sendEmailInputSchema = z
  .object({
    idempotency_key: z.string().max(256).optional(),
    body: z.object({
      from: z.string(),
      to: z.union([z.string(), z.array(z.string()).min(1).max(50)]),
      subject: z.string(),
      bcc: z.union([z.string(), z.array(z.string())]).optional(),
      cc: z.union([z.string(), z.array(z.string())]).optional(),
      reply_to: z.union([z.string(), z.array(z.string())]).optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      template: z
        .object({
          id: z.string(),
          variables: z
            .object({})
            .catchall(z.union([z.string(), z.number()]))
            .optional(),
        })
        .optional(),
      headers: z.object({}).passthrough().optional(),
      scheduled_at: z.string().optional(),
      attachments: z
        .array(
          z.object({
            content: z.string().optional(),
            filename: z.string().optional(),
            path: z.string().optional(),
            content_type: z.string().optional(),
            content_id: z.string().optional(),
          }),
        )
        .optional(),
      tags: z.array(z.object({ name: z.string().optional(), value: z.string().optional() })).optional(),
      topic_id: z.string().optional(),
    }),
  })
  .refine(
    input =>
      input.body.template
        ? input.body.html === undefined && input.body.text === undefined
        : Boolean(input.body.html || input.body.text),
    {
      message: 'Provide html or text, or a template without html/text',
      path: ['body'],
    },
  );

const ProviderResponseSchema = z.object({ id: z.string().optional() }).passthrough();

export const sendEmailOutputSchema = ProviderResponseSchema;

export function sendEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_send_email',
    description: 'Send email in Resend.',
    inputSchema: sendEmailInputSchema,
    outputSchema: sendEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails`,
        retries: input.idempotency_key ? 3 : 0,
        data: input.body,
        headers: input.idempotency_key ? { 'Idempotency-Key': input.idempotency_key } : {},
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
