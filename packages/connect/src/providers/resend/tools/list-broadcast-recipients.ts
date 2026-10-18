// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBroadcastRecipientsInputSchema = z
  .object({
    id: z.string(),
    type: z.enum(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'suppressed']),
    email: z.string().optional(),
    bounce_type: z.enum(['permanent', 'transient', 'undetermined']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .passthrough()
  .refine(input => input.after === undefined || input.before === undefined, {
    message: 'Use either after or before, not both',
  })
  .refine(input => input.bounce_type === undefined || input.type === 'bounced', {
    message: 'bounce_type is only valid when type is bounced',
    path: ['bounce_type'],
  });

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
    data: z
      .array(
        z
          .object({
            id: z.string().optional(),
            contact_id: z.string().nullable().optional(),
            email: z.string().optional(),
            count: z.number().int().optional(),
            bounce_type: z.enum(['permanent', 'transient', 'undetermined']).or(z.string()).optional(),
            clicked_links: z
              .array(z.object({ url: z.string().optional(), clicks: z.number().int().optional() }).passthrough())
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listBroadcastRecipientsOutputSchema = ProviderResponseSchema.extend({
  next_cursor: z.string().optional(),
});

export function listBroadcastRecipientsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_broadcast_recipients',
    description:
      'Retrieve broadcast recipients in Resend. Returns one page; pass next_cursor back as after, or as before when paginating backwards, to continue.',
    inputSchema: listBroadcastRecipientsInputSchema,
    outputSchema: listBroadcastRecipientsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBroadcastRecipientsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['type'] !== undefined) params['type'] = String(input['type']);
      if (input['email'] !== undefined) params['email'] = String(input['email']);
      if (input['bounce_type'] !== undefined) params['bounce_type'] = String(input['bounce_type']);
      if (input['limit'] !== undefined) params['limit'] = String(input['limit']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      if (input['before'] !== undefined) params['before'] = String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}/recipients`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      const nextCursor = input['before'] !== undefined ? data.data?.[0]?.id : data.data?.at(-1)?.id;
      return { ...data, next_cursor: data.has_more ? nextCursor : undefined };
    },
  });
}
