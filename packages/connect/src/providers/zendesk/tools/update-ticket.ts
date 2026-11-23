// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CommentInputSchema = z.object({
  body: z.string().describe('The body of the comment. Example: "This issue has been resolved."'),
  public: z
    .boolean()
    .optional()
    .describe('Whether the comment is public (visible to requester) or internal. Default: true'),
  author_id: z
    .number()
    .optional()
    .describe('The ID of the user who authored the comment. Defaults to the authenticated user.'),
});

const CustomFieldInputSchema = z.object({
  id: z.number().describe('The ID of the custom field.'),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
    .describe(
      'The value to set for the custom field: an array of option tags for a multi-select field, or null to clear it.',
    ),
});

export const updateTicketInputSchema = z.object({
  ticket_id: z.number().describe('The ID of the ticket to update. Example: 12345'),
  subject: z.string().optional().describe('The subject of the ticket.'),
  status: z
    .enum(['new', 'open', 'pending', 'hold', 'solved', 'closed'])
    .optional()
    .describe('The status of the ticket.'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional().describe('The priority of the ticket.'),
  assignee_id: z.number().optional().describe('The ID of the agent to assign the ticket to.'),
  group_id: z.number().optional().describe('The ID of the group to assign the ticket to.'),
  requester_id: z.number().optional().describe('The ID of the requester (end user) of the ticket.'),
  tags: z.array(z.string()).optional().describe('Array of tags to apply to the ticket.'),
  custom_fields: z
    .array(CustomFieldInputSchema)
    .optional()
    .describe('Array of custom field objects with id and value.'),
  comment: CommentInputSchema.optional().describe('Optional comment to add when updating the ticket.'),
});

const TicketFieldSchema = z.object({
  id: z.number(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
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
  requester_id: z.number(),
  submitter_id: z.number(),
  assignee_id: z.number().nullable().optional(),
  organization_id: z.number().nullable().optional(),
  group_id: z.number().nullable().optional(),
  collaborator_ids: z.array(z.number()).optional(),
  follower_ids: z.array(z.number()).optional(),
  email_cc_ids: z.array(z.number()).optional(),
  forum_topic_id: z.number().nullable().optional(),
  problem_id: z.number().nullable().optional(),
  has_incidents: z.boolean(),
  is_public: z.boolean(),
  due_at: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.array(TicketFieldSchema).optional(),
  satisfaction_rating: z.unknown().nullable().optional(),
  sharing_agreement_ids: z.array(z.number()).optional(),
  fields: z.array(TicketFieldSchema).optional(),
  ticket_form_id: z.number().nullable().optional(),
  brand_id: z.number().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ProviderResponseSchema = z.object({
  ticket: ProviderTicketSchema,
});

export const updateTicketOutputSchema = z.object({
  id: z.number(),
  url: z.string(),
  subject: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  status: z.string(),
  recipient: z.string().optional(),
  requester_id: z.number(),
  submitter_id: z.number(),
  assignee_id: z.number().optional(),
  organization_id: z.number().optional(),
  group_id: z.number().optional(),
  collaborator_ids: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.array(TicketFieldSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function updateTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_update_ticket',
    description: 'Update an existing ticket and optionally add a comment',
    inputSchema: updateTicketInputSchema,
    outputSchema: updateTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const ticketId = input.ticket_id;

      // Build the ticket update payload
      const ticketPayload: {
        subject?: string;
        status?: string;
        priority?: string;
        assignee_id?: number;
        group_id?: number;
        requester_id?: number;
        tags?: string[];
        custom_fields?: Array<{ id: number; value: string | number | boolean | string[] | null }>;
        comment?: {
          body: string;
          public?: boolean;
          author_id?: number;
        };
      } = {};

      if (input.subject !== undefined) {
        ticketPayload.subject = input.subject;
      }
      if (input.status !== undefined) {
        ticketPayload.status = input.status;
      }
      if (input.priority !== undefined) {
        ticketPayload.priority = input.priority;
      }
      if (input.assignee_id !== undefined) {
        ticketPayload.assignee_id = input.assignee_id;
      }
      if (input.group_id !== undefined) {
        ticketPayload.group_id = input.group_id;
      }
      if (input.requester_id !== undefined) {
        ticketPayload.requester_id = input.requester_id;
      }
      if (input.tags !== undefined) {
        ticketPayload.tags = input.tags;
      }
      if (input.custom_fields !== undefined) {
        ticketPayload.custom_fields = input.custom_fields;
      }
      if (input.comment !== undefined) {
        ticketPayload.comment = {
          body: input.comment.body,
          ...(input.comment.public !== undefined && { public: input.comment.public }),
          ...(input.comment.author_id !== undefined && { author_id: input.comment.author_id }),
        };
      }

      // https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#update-ticket
      const response = await platformProxy.put({
        endpoint: `/api/v2/tickets/${encodeURIComponent(ticketId)}.json`,
        data: {
          ticket: ticketPayload,
        },
        retries: 1,
      });

      const parsed = ProviderResponseSchema.parse(response.data);
      const ticket = parsed.ticket;

      return {
        id: ticket.id,
        url: ticket.url,
        ...(ticket.subject != null && { subject: ticket.subject }),
        ...(ticket.description != null && { description: ticket.description }),
        ...(ticket.priority != null && { priority: ticket.priority }),
        status: ticket.status,
        ...(ticket.recipient != null && { recipient: ticket.recipient }),
        requester_id: ticket.requester_id,
        submitter_id: ticket.submitter_id,
        ...(ticket.assignee_id != null && { assignee_id: ticket.assignee_id }),
        ...(ticket.organization_id != null && { organization_id: ticket.organization_id }),
        ...(ticket.group_id != null && { group_id: ticket.group_id }),
        ...(ticket.collaborator_ids != null && { collaborator_ids: ticket.collaborator_ids }),
        ...(ticket.tags != null && { tags: ticket.tags }),
        ...(ticket.custom_fields != null && { custom_fields: ticket.custom_fields }),
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
      };
    },
  });
}
