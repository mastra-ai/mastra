// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBroadcastClickedLinksInputSchema = z
  .object({
    id: z.string(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .passthrough()
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
            id: z.string().optional(),
            url: z.string().optional(),
            clicks: z.number().int().optional(),
            unique_clicks: z.number().int().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listBroadcastClickedLinksOutputSchema = ProviderResponseSchema.extend({
  next_cursor: z.string().optional(),
});

export function listBroadcastClickedLinksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_broadcast_clicked_links',
    description:
      "Retrieve a broadcast's clicked links in Resend. Returns one page; pass next_cursor back as after, or as before when paginating backwards, to continue.",
    inputSchema: listBroadcastClickedLinksInputSchema,
    outputSchema: listBroadcastClickedLinksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBroadcastClickedLinksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined) params['limit'] = String(input['limit']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      if (input['before'] !== undefined) params['before'] = String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}/clicked-links`,
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
