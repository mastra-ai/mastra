// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTicketsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().min(1).max(100).optional().describe('Number of items to return per page. Maximum is 100.'),
});

const ProviderTicketSchema = z.object({
  id: z.number(),
  url: z.string(),
  external_id: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  raw_subject: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  status: z.string(),
  recipient: z.string().nullable().optional(),
  requester_id: z.number().optional(),
  submitter_id: z.number().optional(),
  assignee_id: z.number().nullable().optional(),
  organization_id: z.number().nullable().optional(),
  group_id: z.number().nullable().optional(),
  collaborator_ids: z.array(z.number()).optional(),
  follower_ids: z.array(z.number()).optional(),
  email_cc_ids: z.array(z.number()).optional(),
  forum_topic_id: z.number().nullable().optional(),
  problem_id: z.number().nullable().optional(),
  has_incidents: z.boolean().optional(),
  is_public: z.boolean().optional(),
  due_at: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
  satisfaction_rating: z.object({ score: z.string().optional(), comment: z.string().optional() }).nullable().optional(),
  sharing_agreement_ids: z.array(z.number()).optional(),
  fields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
  followup_ids: z.array(z.number()).optional(),
  ticket_form_id: z.number().nullable().optional(),
  brand_id: z.number().nullable().optional(),
  allow_channelback: z.boolean().optional(),
  allow_attachments: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const TicketOutputSchema = z.object({
  id: z.number().describe('Ticket ID. Example: 123'),
  url: z.string().describe('API URL for the ticket'),
  external_id: z.string().optional().describe('External platform ID'),
  type: z.string().optional().describe('Ticket type'),
  subject: z.string().optional().describe('Ticket subject'),
  raw_subject: z.string().optional().describe('Dynamic content placeholder for subject'),
  description: z.string().optional().describe('Ticket description'),
  priority: z.string().optional().describe('Ticket priority'),
  status: z.string().describe('Ticket status'),
  recipient: z.string().optional().describe('Original recipient email address'),
  requester_id: z.number().optional().describe('User ID of the requester'),
  submitter_id: z.number().optional().describe('User ID of the submitter'),
  assignee_id: z.number().optional().describe('User ID of the assignee'),
  organization_id: z.number().optional().describe('Organization ID'),
  group_id: z.number().optional().describe('Group ID'),
  collaborator_ids: z.array(z.number()).optional().describe('User IDs of collaborators'),
  follower_ids: z.array(z.number()).optional().describe('User IDs of followers'),
  email_cc_ids: z.array(z.number()).optional().describe('User IDs in email CC'),
  forum_topic_id: z.number().optional().describe('Topic ID in the community'),
  problem_id: z.number().optional().describe('Problem ticket ID for incidents'),
  has_incidents: z.boolean().optional().describe('Whether ticket has linked incidents'),
  is_public: z.boolean().optional().describe('Whether ticket is public'),
  due_at: z.string().optional().describe('Due date for tickets of type task'),
  tags: z.array(z.string()).optional().describe('Array of tags'),
  custom_fields: z
    .array(z.object({ id: z.number(), value: z.unknown() }))
    .optional()
    .describe('Custom field values'),
  satisfaction_rating: z
    .object({ score: z.string().optional(), comment: z.string().optional() })
    .optional()
    .describe('Satisfaction rating'),
  sharing_agreement_ids: z.array(z.number()).optional().describe('Sharing agreement IDs'),
  followup_ids: z.array(z.number()).optional().describe('Followup ticket IDs'),
  ticket_form_id: z.number().optional().describe('Ticket form ID'),
  brand_id: z.number().optional().describe('Brand ID'),
  allow_channelback: z.boolean().optional().describe('Whether channelback is allowed'),
  allow_attachments: z.boolean().optional().describe('Whether attachments are allowed'),
  created_at: z.string().optional().describe('Creation timestamp'),
  updated_at: z.string().optional().describe('Last update timestamp'),
});

const ProviderListResponseSchema = z.object({
  tickets: z.array(ProviderTicketSchema),
  meta: z
    .object({
      has_more: z.boolean().optional(),
      after_cursor: z.string().nullish(),
    })
    .optional(),
});

export const listTicketsOutputSchema = z.object({
  tickets: z.array(TicketOutputSchema).describe('Array of tickets'),
  next_cursor: z.string().optional().describe('Cursor for the next page of results'),
  has_more: z.boolean().optional().describe('Whether there are more results'),
});

export function listTicketsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_tickets',
    description: 'List tickets in Zendesk Support',
    inputSchema: listTicketsInputSchema,
    outputSchema: listTicketsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTicketsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {
        'page[size]': input.page_size ?? 100,
      };

      if (input.cursor) {
        params['page[after]'] = input.cursor;
      }

      // https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/
      const response = await platformProxy.get({
        endpoint: '/api/v2/tickets.json',
        params,
        retries: 3,
      });

      const data = ProviderListResponseSchema.parse(response.data);

      const tickets = data.tickets.map(ticket => {
        const parsed = ProviderTicketSchema.parse(ticket);
        return {
          id: parsed.id,
          url: parsed.url,
          ...(parsed.external_id != null && { external_id: parsed.external_id }),
          ...(parsed.type != null && { type: parsed.type }),
          ...(parsed.subject != null && { subject: parsed.subject }),
          ...(parsed.raw_subject != null && { raw_subject: parsed.raw_subject }),
          ...(parsed.description != null && { description: parsed.description }),
          ...(parsed.priority != null && { priority: parsed.priority }),
          status: parsed.status,
          ...(parsed.recipient != null && { recipient: parsed.recipient }),
          ...(parsed.requester_id !== undefined && { requester_id: parsed.requester_id }),
          ...(parsed.submitter_id !== undefined && { submitter_id: parsed.submitter_id }),
          ...(parsed.assignee_id !== undefined && parsed.assignee_id !== null && { assignee_id: parsed.assignee_id }),
          ...(parsed.organization_id !== undefined &&
            parsed.organization_id !== null && { organization_id: parsed.organization_id }),
          ...(parsed.group_id !== undefined && parsed.group_id !== null && { group_id: parsed.group_id }),
          ...(parsed.collaborator_ids !== undefined && { collaborator_ids: parsed.collaborator_ids }),
          ...(parsed.follower_ids !== undefined && { follower_ids: parsed.follower_ids }),
          ...(parsed.email_cc_ids !== undefined && { email_cc_ids: parsed.email_cc_ids }),
          ...(parsed.forum_topic_id !== undefined &&
            parsed.forum_topic_id !== null && { forum_topic_id: parsed.forum_topic_id }),
          ...(parsed.problem_id !== undefined && parsed.problem_id !== null && { problem_id: parsed.problem_id }),
          ...(parsed.has_incidents !== undefined && { has_incidents: parsed.has_incidents }),
          ...(parsed.is_public !== undefined && { is_public: parsed.is_public }),
          ...(parsed.due_at !== undefined && parsed.due_at !== null && { due_at: parsed.due_at }),
          ...(parsed.tags !== undefined && { tags: parsed.tags }),
          ...(parsed.custom_fields !== undefined && { custom_fields: parsed.custom_fields }),
          ...(parsed.satisfaction_rating !== undefined &&
            parsed.satisfaction_rating !== null && { satisfaction_rating: parsed.satisfaction_rating }),
          ...(parsed.sharing_agreement_ids !== undefined && { sharing_agreement_ids: parsed.sharing_agreement_ids }),
          ...(parsed.followup_ids !== undefined && { followup_ids: parsed.followup_ids }),
          ...(parsed.ticket_form_id !== undefined &&
            parsed.ticket_form_id !== null && { ticket_form_id: parsed.ticket_form_id }),
          ...(parsed.brand_id !== undefined && parsed.brand_id !== null && { brand_id: parsed.brand_id }),
          ...(parsed.allow_channelback !== undefined && { allow_channelback: parsed.allow_channelback }),
          ...(parsed.allow_attachments !== undefined && { allow_attachments: parsed.allow_attachments }),
          ...(parsed.created_at !== undefined && { created_at: parsed.created_at }),
          ...(parsed.updated_at !== undefined && { updated_at: parsed.updated_at }),
        };
      });

      return {
        tickets,
        ...(data.meta?.has_more && data.meta.after_cursor && { next_cursor: data.meta.after_cursor }),
        ...(data.meta?.has_more !== undefined && { has_more: data.meta.has_more }),
      };
    },
  });
}
