// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listEmailAttachmentsInputSchema = z
  .object({
    email_id: z.string(),
    limit: z.number().int().optional(),
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
            filename: z.string().nullable().optional(),
            content_type: z.string().optional(),
            content_id: z.string().optional(),
            content_disposition: z.enum(['inline', 'attachment']).or(z.string()).nullable().optional(),
            download_url: z.string().optional(),
            expires_at: z.string().optional(),
            size: z.number().int().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listEmailAttachmentsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listEmailAttachmentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_email_attachments',
    description:
      'Retrieve a list of attachments for a sent email in Resend. Returns one page; pass next_cursor back as after, or as before when paginating backwards, to continue.',
    inputSchema: listEmailAttachmentsInputSchema,
    outputSchema: listEmailAttachmentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEmailAttachmentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined) params['limit'] = String(input['limit']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      if (input['before'] !== undefined) params['before'] = String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/${encodeURIComponent(input['email_id'])}/attachments`,
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
