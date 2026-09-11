// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listEmailsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .refine(input => input.after === undefined || input.before === undefined, {
    message: 'Use either after or before, not both',
  });

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
    data: z
      .array(
        z
          .object({
            object: z.string().optional(),
            id: z.string().optional(),
            message_id: z.string().optional(),
            to: z.array(z.string()).optional(),
            from: z.string().optional(),
            created_at: z.string().optional(),
            subject: z.string().optional(),
            html: z.string().optional(),
            text: z.string().optional(),
            bcc: z.array(z.string()).optional(),
            cc: z.array(z.string()).optional(),
            reply_to: z.array(z.string()).optional(),
            last_event: z
              .enum([
                'bounced',
                'canceled',
                'clicked',
                'complained',
                'delivered',
                'delivery_delayed',
                'failed',
                'opened',
                'queued',
                'scheduled',
                'sent',
                'suppressed',
              ])
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listEmailsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listEmailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_emails',
    description: 'List emails in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listEmailsInputSchema,
    outputSchema: listEmailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEmailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      if (input['after'] !== undefined) params['after'] = input['after'];
      if (input['before'] !== undefined) params['before'] = input['before'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
