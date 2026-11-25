// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTicketCommentsInputSchema = z.object({
  ticket_id: z.number().describe('The ID of the ticket. Example: 123'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  per_page: z.number().optional().describe('Number of records to return per page (default 100, max 100).'),
});

const AttachmentSchema = z
  .object({
    id: z.number(),
    file_name: z.string(),
    content_url: z.string().optional(),
    content_type: z.string().optional(),
    size: z.number().optional(),
  })
  .passthrough();

const ViaSchema = z.object({}).passthrough();

const MetadataSchema = z.object({}).passthrough();

const ProviderCommentSchema = z
  .object({
    id: z.number(),
    type: z.string().optional(),
    body: z.string().optional(),
    html_body: z.string().optional(),
    plain_body: z.string().optional(),
    public: z.boolean().optional(),
    author_id: z.number().optional(),
    audit_id: z.number().optional(),
    created_at: z.string().optional(),
    attachments: z.array(AttachmentSchema).optional(),
    metadata: MetadataSchema.optional(),
    via: ViaSchema.optional(),
  })
  .passthrough();

const MetaSchema = z.object({
  has_more: z.boolean().optional(),
  after_cursor: z.string().nullish(),
});

const ProviderResponseSchema = z.object({
  comments: z.array(z.unknown()),
  meta: MetaSchema.optional(),
});

const CommentSchema = z.object({
  id: z.number(),
  type: z.string().optional(),
  body: z.string().optional(),
  html_body: z.string().optional(),
  plain_body: z.string().optional(),
  public: z.boolean().optional(),
  author_id: z.number().optional(),
  audit_id: z.number().optional(),
  created_at: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  metadata: MetadataSchema.optional(),
  via: ViaSchema.optional(),
});

export const getTicketCommentsOutputSchema = z.object({
  comments: z.array(CommentSchema),
  next_cursor: z.string().optional(),
});

export function getTicketCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_ticket_comments',
    description: 'List comments for a ticket.',
    inputSchema: getTicketCommentsInputSchema,
    outputSchema: getTicketCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTicketCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      params['page[size]'] = input.per_page ?? 100;
      if (input.cursor !== undefined) {
        params['page[after]'] = input.cursor;
      }

      // https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_comments/
      const response = await platformProxy.get({
        endpoint: `/api/v2/tickets/${input.ticket_id}/comments.json`,
        params: params,
        retries: 3,
      });

      const responseData = ProviderResponseSchema.parse(response.data);

      if (!Array.isArray(responseData.comments)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Zendesk API',
        });
      }

      const comments = responseData.comments.map(item => {
        const parsed = ProviderCommentSchema.parse(item);
        return {
          id: parsed.id,
          ...(parsed.type !== undefined && { type: parsed.type }),
          ...(parsed.body !== undefined && { body: parsed.body }),
          ...(parsed.html_body !== undefined && { html_body: parsed.html_body }),
          ...(parsed.plain_body !== undefined && { plain_body: parsed.plain_body }),
          ...(parsed.public !== undefined && { public: parsed.public }),
          ...(parsed.author_id !== undefined && { author_id: parsed.author_id }),
          ...(parsed.audit_id !== undefined && { audit_id: parsed.audit_id }),
          ...(parsed.created_at !== undefined && { created_at: parsed.created_at }),
          ...(parsed.attachments !== undefined && { attachments: parsed.attachments }),
          ...(parsed.metadata !== undefined && { metadata: parsed.metadata }),
          ...(parsed.via !== undefined && { via: parsed.via }),
        };
      });

      return {
        comments,
        ...(responseData.meta?.has_more &&
          responseData.meta.after_cursor && { next_cursor: responseData.meta.after_cursor }),
      };
    },
  });
}
